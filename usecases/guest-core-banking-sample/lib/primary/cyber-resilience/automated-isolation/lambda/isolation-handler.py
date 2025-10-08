import json
import boto3
import logging
from typing import Dict, List, Any
from datetime import datetime

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS クライアント
ec2_client = boto3.client('ec2')
sns_client = boto3.client('sns')

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    GuardDuty Critical Findingsを受信してネットワーク隔離を実行するLambda関数
    冪等性を考慮し、既に隔離済みの場合は重複処理を回避
    """
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # EventBridgeからのGuardDutyイベントを解析
        detail = event.get('detail', {})
        finding_id = detail.get('id', 'unknown')
        severity = detail.get('severity', 0)
        finding_type = detail.get('type', 'unknown')
        
        logger.info(f"Processing GuardDuty finding: {finding_id}, severity: {severity}, type: {finding_type}")
        
        # Severityが9.0以上（Critical）の場合のみ処理
        if severity < 9.0:
            logger.info(f"Severity {severity} is not critical (< 9.0). Skipping isolation.")
            return {
                'statusCode': 200,
                'body': json.dumps('Severity not critical, no action taken')
            }
        
        # 環境変数から設定を取得
        import os
        vpc_id = os.environ.get('VPC_ID')
        sns_topic_arn = os.environ.get('SNS_TOPIC_ARN')
        env_name = os.environ.get('ENV_NAME', 'unknown')
        
        if not vpc_id or not sns_topic_arn:
            raise ValueError("Required environment variables VPC_ID or SNS_TOPIC_ARN not found")
        
        # Protected Subnetを取得
        protected_subnets = get_protected_subnets(vpc_id)
        
        if not protected_subnets:
            logger.warning("No protected subnets found")
            return {
                'statusCode': 200,
                'body': json.dumps('No protected subnets found')
            }
        
        # 既に隔離済みかチェック
        isolation_status = check_isolation_status(protected_subnets)
        
        if isolation_status['already_isolated']:
            logger.info(f"Subnets already isolated. Existing isolation: {isolation_status['isolated_subnets']}")
            
            # 既に隔離済みの場合も通知を送信（重複通知防止のため簡略化）
            send_already_isolated_notification(
                sns_topic_arn,
                finding_id,
                finding_type,
                severity,
                isolation_status,
                env_name
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Subnets already isolated',
                    'finding_id': finding_id,
                    'existing_isolation': isolation_status
                })
            }
        
        # ネットワーク隔離を実行
        isolation_result = isolate_protected_subnets(protected_subnets, finding_id)
        
        # SNS通知を送信
        send_isolation_notification(
            sns_topic_arn, 
            finding_id, 
            finding_type, 
            severity, 
            isolation_result,
            env_name
        )
        
        logger.info("Network isolation completed successfully")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Network isolation completed',
                'finding_id': finding_id,
                'isolated_subnets': len(protected_subnets),
                'isolation_details': isolation_result
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing isolation: {str(e)}")
        
        # エラー通知も送信
        try:
            sns_topic_arn = os.environ.get('SNS_TOPIC_ARN')
            if sns_topic_arn:
                send_error_notification(sns_topic_arn, str(e), event.get('detail', {}).get('id', 'unknown'))
        except:
            pass
        
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }

def check_isolation_status(subnets: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Protected Subnetが既に隔離済みかチェック
    """
    try:
        isolated_subnets = []
        
        for subnet in subnets:
            subnet_id = subnet['SubnetId']
            
            # 現在のNACL associationを取得
            associations_response = ec2_client.describe_network_acls(
                Filters=[
                    {'Name': 'association.subnet-id', 'Values': [subnet_id]}
                ]
            )
            
            for nacl in associations_response['NetworkAcls']:
                # 隔離用NACLかチェック（Purposeタグで判定）
                for tag in nacl.get('Tags', []):
                    if tag['Key'] == 'Purpose' and tag['Value'] == 'CyberResilienceIsolation':
                        isolated_subnets.append({
                            'subnet_id': subnet_id,
                            'nacl_id': nacl['NetworkAclId'],
                            'status': 'already_isolated'
                        })
                        logger.info(f"Subnet {subnet_id} is already isolated with NACL {nacl['NetworkAclId']}")
                        break
        
        return {
            'already_isolated': len(isolated_subnets) > 0,
            'isolated_subnets': isolated_subnets,
            'total_subnets': len(subnets),
            'isolation_coverage': len(isolated_subnets) / len(subnets) if subnets else 0
        }
        
    except Exception as e:
        logger.error(f"Error checking isolation status: {str(e)}")
        return {
            'already_isolated': False,
            'isolated_subnets': [],
            'total_subnets': len(subnets),
            'isolation_coverage': 0,
            'error': str(e)
        }

def get_protected_subnets(vpc_id: str) -> List[Dict[str, Any]]:
    """
    指定されたVPCのProtected Subnetを取得
    """
    try:
        response = ec2_client.describe_subnets(
            Filters=[
                {'Name': 'vpc-id', 'Values': [vpc_id]},
                {'Name': 'tag:Name', 'Values': ['*Protected*']}
            ]
        )
        
        subnets = response.get('Subnets', [])
        logger.info(f"Found {len(subnets)} protected subnets in VPC {vpc_id}")
        
        return subnets
        
    except Exception as e:
        logger.error(f"Error getting protected subnets: {str(e)}")
        raise

def isolate_protected_subnets(subnets: List[Dict[str, Any]], finding_id: str) -> Dict[str, Any]:
    """
    Protected Subnet間の通信のみを許可し、その他を遮断するNACLを作成・適用
    冪等性を考慮し、既存の隔離用NACLがある場合は再利用
    """
    isolation_results = []
    
    try:
        # Protected Subnet間の通信を許可するCIDRリストを作成
        protected_cidrs = [subnet['CidrBlock'] for subnet in subnets]
        logger.info(f"Protected CIDRs: {protected_cidrs}")
        
        for subnet in subnets:
            subnet_id = subnet['SubnetId']
            vpc_id = subnet['VpcId']
            
            # 既存の隔離用NACLをチェック
            existing_isolation_nacl = find_existing_isolation_nacl(subnet_id)
            
            if existing_isolation_nacl:
                logger.info(f"Reusing existing isolation NACL {existing_isolation_nacl} for subnet {subnet_id}")
                isolation_results.append({
                    'subnet_id': subnet_id,
                    'nacl_id': existing_isolation_nacl,
                    'status': 'reused_existing'
                })
                continue
            
            # 新しい隔離用NACLを作成
            nacl_id = create_isolation_nacl(vpc_id, subnet_id, finding_id, protected_cidrs)
            
            # NACL associationを変更
            replace_nacl_association(subnet_id, nacl_id)
            
            isolation_results.append({
                'subnet_id': subnet_id,
                'nacl_id': nacl_id,
                'status': 'newly_isolated'
            })
        
        return {
            'status': 'success',
            'isolated_subnets': len(subnets),
            'details': isolation_results
        }
        
    except Exception as e:
        logger.error(f"Error isolating subnets: {str(e)}")
        raise

def find_existing_isolation_nacl(subnet_id: str) -> str:
    """
    指定されたSubnetに既に適用されている隔離用NACLを検索
    """
    try:
        associations_response = ec2_client.describe_network_acls(
            Filters=[
                {'Name': 'association.subnet-id', 'Values': [subnet_id]}
            ]
        )
        
        for nacl in associations_response['NetworkAcls']:
            # 隔離用NACLかチェック（Purposeタグで判定）
            for tag in nacl.get('Tags', []):
                if tag['Key'] == 'Purpose' and tag['Value'] == 'CyberResilienceIsolation':
                    return nacl['NetworkAclId']
        
        return None
        
    except Exception as e:
        logger.error(f"Error finding existing isolation NACL for subnet {subnet_id}: {str(e)}")
        return None

def create_isolation_nacl(vpc_id: str, subnet_id: str, finding_id: str, protected_cidrs: List[str]) -> str:
    """
    新しい隔離用NACLを作成
    """
    try:
        # 隔離用のNACLを作成
        nacl_response = ec2_client.create_network_acl(
            VpcId=vpc_id,
            TagSpecifications=[
                {
                    'ResourceType': 'network-acl',
                    'Tags': [
                        {'Key': 'Name', 'Value': f'isolation-nacl-{subnet_id}-{finding_id[:8]}'},
                        {'Key': 'Purpose', 'Value': 'CyberResilienceIsolation'},
                        {'Key': 'FindingId', 'Value': finding_id},
                        {'Key': 'CreatedAt', 'Value': datetime.utcnow().isoformat()},
                        {'Key': 'SubnetId', 'Value': subnet_id}
                    ]
                }
            ]
        )
        
        nacl_id = nacl_response['NetworkAcl']['NetworkAclId']
        logger.info(f"Created isolation NACL {nacl_id} for subnet {subnet_id}")
        
        # Protected Subnet間の通信を許可するルールを追加
        add_nacl_rules(nacl_id, protected_cidrs)
        
        return nacl_id
        
    except Exception as e:
        logger.error(f"Error creating isolation NACL for subnet {subnet_id}: {str(e)}")
        raise

def add_nacl_rules(nacl_id: str, protected_cidrs: List[str]):
    """
    NACLにProtected Subnet間通信を許可するルールを追加
    """
    try:
        rule_number = 100
        
        # Ingress rules - Protected Subnet間の通信を許可
        for protected_cidr in protected_cidrs:
            ec2_client.create_network_acl_entry(
                NetworkAclId=nacl_id,
                RuleNumber=rule_number,
                Protocol='-1',  # All protocols
                RuleAction='allow',
                CidrBlock=protected_cidr,
                Egress=False
            )
            rule_number += 10
        
        # Egress rules - Protected Subnet間の通信を許可
        rule_number = 100
        for protected_cidr in protected_cidrs:
            ec2_client.create_network_acl_entry(
                NetworkAclId=nacl_id,
                RuleNumber=rule_number,
                Protocol='-1',  # All protocols
                RuleAction='allow',
                CidrBlock=protected_cidr,
                Egress=True
            )
            rule_number += 10
            
        logger.info(f"Added NACL rules for {len(protected_cidrs)} protected CIDRs to NACL {nacl_id}")
        
    except Exception as e:
        logger.error(f"Error adding NACL rules to {nacl_id}: {str(e)}")
        raise

def replace_nacl_association(subnet_id: str, nacl_id: str):
    """
    SubnetのNACL associationを隔離用NACLに変更
    """
    try:
        # 既存のNACL associationを取得
        associations_response = ec2_client.describe_network_acls(
            Filters=[
                {'Name': 'association.subnet-id', 'Values': [subnet_id]}
            ]
        )
        
        # 既存のassociationを置き換え
        for nacl in associations_response['NetworkAcls']:
            for association in nacl['Associations']:
                if association['SubnetId'] == subnet_id:
                    ec2_client.replace_network_acl_association(
                        AssociationId=association['NetworkAclAssociationId'],
                        NetworkAclId=nacl_id
                    )
                    logger.info(f"Replaced NACL association for subnet {subnet_id} with isolation NACL {nacl_id}")
                    return
        
        logger.warning(f"No existing NACL association found for subnet {subnet_id}")
        
    except Exception as e:
        logger.error(f"Error replacing NACL association for subnet {subnet_id}: {str(e)}")
        raise

def send_already_isolated_notification(sns_topic_arn: str, finding_id: str, finding_type: str, 
                                    severity: float, isolation_status: Dict[str, Any], env_name: str):
    """
    既に隔離済みの場合の通知をSNSで送信
    """
    try:
        subject = f"[{env_name}] Critical Security Event - Network Already Isolated"
        
        message = f"""
CRITICAL SECURITY ALERT - NETWORK ALREADY ISOLATED

Environment: {env_name}
Timestamp: {datetime.utcnow().isoformat()}Z

GuardDuty Finding Details:
- Finding ID: {finding_id}
- Finding Type: {finding_type}
- Severity: {severity}

Isolation Status:
- Already Isolated: {isolation_status.get('already_isolated', False)}
- Isolated Subnets: {len(isolation_status.get('isolated_subnets', []))}
- Total Subnets: {isolation_status.get('total_subnets', 0)}
- Coverage: {isolation_status.get('isolation_coverage', 0):.2%}

Protected subnets are already isolated. No additional action was taken.

Existing Isolation Details: {json.dumps(isolation_status.get('isolated_subnets', []), indent=2)}
"""
        
        sns_client.publish(
            TopicArn=sns_topic_arn,
            Subject=subject,
            Message=message
        )
        
        logger.info("Already isolated notification sent successfully")
        
    except Exception as e:
        logger.error(f"Error sending already isolated notification: {str(e)}")

def send_isolation_notification(sns_topic_arn: str, finding_id: str, finding_type: str, 
                              severity: float, isolation_result: Dict[str, Any], env_name: str):
    """
    隔離完了通知をSNSで送信
    """
    try:
        subject = f"[{env_name}] Critical Security Event - Network Isolation Activated"
        
        message = f"""
CRITICAL SECURITY ALERT - NETWORK ISOLATION ACTIVATED

Environment: {env_name}
Timestamp: {datetime.utcnow().isoformat()}Z

GuardDuty Finding Details:
- Finding ID: {finding_id}
- Finding Type: {finding_type}
- Severity: {severity}

Isolation Action Taken:
- Status: {isolation_result.get('status', 'unknown')}
- Isolated Subnets: {isolation_result.get('isolated_subnets', 0)}

Protected subnets have been isolated to allow communication only between themselves.
All other inbound and outbound traffic has been blocked.

Please review the security incident and take appropriate remediation actions.

Details: {json.dumps(isolation_result.get('details', []), indent=2)}
"""
        
        sns_client.publish(
            TopicArn=sns_topic_arn,
            Subject=subject,
            Message=message
        )
        
        logger.info("Isolation notification sent successfully")
        
    except Exception as e:
        logger.error(f"Error sending isolation notification: {str(e)}")
        raise

def send_error_notification(sns_topic_arn: str, error_message: str, finding_id: str):
    """
    エラー通知をSNSで送信
    """
    try:
        subject = "ERROR - Network Isolation Failed"
        
        message = f"""
ERROR: Network isolation process failed

Timestamp: {datetime.utcnow().isoformat()}Z
Finding ID: {finding_id}
Error: {error_message}

Please investigate the issue immediately and consider manual isolation if necessary.
"""
        
        sns_client.publish(
            TopicArn=sns_topic_arn,
            Subject=subject,
            Message=message
        )
        
    except Exception as e:
        logger.error(f"Error sending error notification: {str(e)}")
        
