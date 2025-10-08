import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface DynamoDBStatusLambdaProps {
  /**
   * 環境名
   */
  environment: string;
}

/**
 * DynamoDB状態確認専用Lambda関数
 * StepFunctionsから呼び出される
 */
export class DynamoDBStatusLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: DynamoDBStatusLambdaProps) {
    super(scope, id);

    // Lambda実行ロール
    const executionRole = new iam.Role(this, 'DynamoDBStatusExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    // DynamoDB状態確認に必要な権限
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'backup:DescribeRestoreJob',
          'dynamodb:DescribeTable',
          'dynamodb:ListTables',
          'dynamodb:DescribeGlobalTable',
          'dynamodb:ListGlobalTables',
          'dynamodb:Scan',
          'dynamodb:Query',
          'dynamodb:DescribeTimeToLive',
          'dynamodb:DescribeBackup',
          'dynamodb:DescribeContinuousBackups',
          'ssm:GetParameter',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      }),
    );

    // DynamoDB状態確認Lambda関数
    this.function = new lambda.Function(this, 'Function', {
      functionName: `dynamodb-status-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      role: executionRole,
      environment: {
        ENVIRONMENT: props.environment,
      },
      code: lambda.Code.fromInline(`
import json
import boto3
import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    DynamoDB状態確認Lambda関数
    StepFunctionsから呼び出される
    """
    try:
        logger.info(f"DynamoDB status check request: {json.dumps(event)}")
        
        # 入力パラメータの取得
        restore_job_id = event.get('restore_job_id')
        table_name = event.get('table_name')
        
        if not restore_job_id and not table_name:
            raise ValueError("Either restore_job_id or table_name is required")
        
        # リストアジョブの状態確認
        restore_status = None
        if restore_job_id and restore_job_id != 'EXISTING':
            restore_status = check_restore_job_status(restore_job_id)
        
        # DynamoDBテーブルの状態確認
        table_status = None
        if table_name:
            table_status = check_table_status(table_name)
        
        # Global Tableの状態確認
        global_table_status = None
        if table_name and table_status and table_status.get('status') == 'ACTIVE':
            global_table_status = check_global_table_status(table_name)
        
        # データ整合性の検証
        data_integrity = None
        if table_status and table_status.get('status') == 'ACTIVE':
            data_integrity = verify_data_integrity(table_name)
        
        # 初期データ設定の確認
        initial_data_check = None
        if table_status and table_status.get('status') == 'ACTIVE':
            initial_data_check = verify_initial_data_setup(table_name)
        
        # 総合評価
        overall_status = determine_overall_status(
            restore_status, table_status, global_table_status, 
            data_integrity, initial_data_check
        )
        
        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'restore_job_status': restore_status,
            'table_status': table_status,
            'global_table_status': global_table_status,
            'data_integrity': data_integrity,
            'initial_data_check': initial_data_check,
            'overall_status': overall_status,
            'ready_for_workload': overall_status == 'READY'
        }
        
        logger.info(f"DynamoDB status check completed: {overall_status}")
        
        return {
            'statusCode': 200,
            **result  # 結果を直接返す（bodyフィールドではなく）
        }
        
    except Exception as e:
        logger.error(f"DynamoDB status check failed: {str(e)}")
        return {
            'statusCode': 500,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }

def check_restore_job_status(restore_job_id: str) -> Dict[str, Any]:
    """
    リストアジョブの状態確認
    """
    try:
        backup_client = boto3.client('backup')
        response = backup_client.describe_restore_job(RestoreJobId=restore_job_id)
        
        status = response['Status']
        percent_done = response.get('PercentDone', '0.00%')
        created_resource_arn = response.get('CreatedResourceArn')
        
        return {
            'restore_job_id': restore_job_id,
            'status': status,
            'percent_done': percent_done,
            'created_resource_arn': created_resource_arn,
            'completion_date': response.get('CompletionDate', '').isoformat() if response.get('CompletionDate') else None,
            'status_message': response.get('StatusMessage', '')
        }
        
    except Exception as e:
        logger.error(f"Failed to check restore job status: {str(e)}")
        return {
            'restore_job_id': restore_job_id,
            'status': 'ERROR',
            'error': str(e)
        }

def check_table_status(table_name: str) -> Dict[str, Any]:
    """
    DynamoDBテーブルの状態確認
    """
    try:
        dynamodb_client = boto3.client('dynamodb')
        response = dynamodb_client.describe_table(TableName=table_name)
        
        table = response['Table']
        
        # 基本情報
        basic_info = {
            'table_name': table_name,
            'status': table['TableStatus'],
            'creation_date': table['CreationDateTime'].isoformat(),
            'item_count': table.get('ItemCount', 0),
            'table_size_bytes': table.get('TableSizeBytes', 0),
            'table_arn': table['TableArn']
        }
        
        # スキーマ情報
        schema_info = {
            'key_schema': table.get('KeySchema', []),
            'attribute_definitions': table.get('AttributeDefinitions', []),
            'provisioned_throughput': table.get('ProvisionedThroughput', {}),
            'billing_mode': table.get('BillingModeSummary', {}).get('BillingMode', 'PROVISIONED')
        }
        
        # セキュリティ設定
        security_info = {
            'sse_description': table.get('SSEDescription', {}),
            'encryption_enabled': bool(table.get('SSEDescription', {}).get('Status') == 'ENABLED')
        }
        
        # バックアップ設定
        backup_info = check_backup_settings(table_name)
        
        return {
            **basic_info,
            'schema': schema_info,
            'security': security_info,
            'backup': backup_info
        }
        
    except Exception as e:
        logger.error(f"Failed to check table status: {str(e)}")
        return {
            'table_name': table_name,
            'status': 'ERROR',
            'error': str(e)
        }

def check_global_table_status(table_name: str) -> Dict[str, Any]:
    """
    Global Tableの状態確認
    """
    try:
        dynamodb_client = boto3.client('dynamodb')
        
        # Global Tableの一覧を取得
        global_tables_response = dynamodb_client.list_global_tables()
        global_tables = global_tables_response.get('GlobalTables', [])
        
        # 対象テーブルがGlobal Tableかどうか確認
        target_global_table = None
        for gt in global_tables:
            if gt['GlobalTableName'] == table_name:
                target_global_table = gt
                break
        
        if not target_global_table:
            return {
                'table_name': table_name,
                'is_global_table': False,
                'status': 'NOT_GLOBAL_TABLE',
                'message': 'Table is not configured as Global Table'
            }
        
        # Global Tableの詳細情報を取得
        try:
            gt_response = dynamodb_client.describe_global_table(
                GlobalTableName=table_name
            )
            
            global_table_info = gt_response['GlobalTableDescription']
            
            # レプリケーション状態の確認
            replicas = global_table_info.get('ReplicationGroup', [])
            primary_region = None
            replica_regions = []
            
            for replica in replicas:
                region = replica['RegionName']
                replica_status = replica.get('ReplicaStatus', 'UNKNOWN')
                
                if region == 'ap-northeast-1':  # 東京リージョン
                    primary_region = {
                        'region': region,
                        'status': replica_status,
                        'is_primary': True
                    }
                else:
                    replica_regions.append({
                        'region': region,
                        'status': replica_status,
                        'is_primary': False
                    })
            
            return {
                'table_name': table_name,
                'is_global_table': True,
                'status': global_table_info.get('GlobalTableStatus', 'UNKNOWN'),
                'creation_date': global_table_info.get('CreationDateTime', '').isoformat() if global_table_info.get('CreationDateTime') else None,
                'primary_region': primary_region,
                'replica_regions': replica_regions,
                'total_replicas': len(replicas),
                'replication_healthy': all(r.get('ReplicaStatus') == 'ACTIVE' for r in replicas)
            }
            
        except dynamodb_client.exceptions.GlobalTableNotFoundException:
            return {
                'table_name': table_name,
                'is_global_table': False,
                'status': 'NOT_FOUND',
                'message': 'Global Table configuration not found'
            }
        
    except Exception as e:
        logger.error(f"Failed to check Global Table status: {str(e)}")
        return {
            'table_name': table_name,
            'is_global_table': False,
            'status': 'ERROR',
            'error': str(e)
        }

def check_backup_settings(table_name: str) -> Dict[str, Any]:
    """
    バックアップ設定の確認
    """
    try:
        dynamodb_client = boto3.client('dynamodb')
        
        # 継続的バックアップの設定確認
        backup_response = dynamodb_client.describe_continuous_backups(
            TableName=table_name
        )
        
        continuous_backups = backup_response.get('ContinuousBackupsDescription', {})
        point_in_time_recovery = continuous_backups.get('PointInTimeRecoveryDescription', {})
        
        return {
            'continuous_backups_status': continuous_backups.get('ContinuousBackupsStatus', 'DISABLED'),
            'point_in_time_recovery_status': point_in_time_recovery.get('PointInTimeRecoveryStatus', 'DISABLED'),
            'earliest_restorable_datetime': point_in_time_recovery.get('EarliestRestorableDateTime', '').isoformat() if point_in_time_recovery.get('EarliestRestorableDateTime') else None,
            'latest_restorable_datetime': point_in_time_recovery.get('LatestRestorableDateTime', '').isoformat() if point_in_time_recovery.get('LatestRestorableDateTime') else None
        }
        
    except Exception as e:
        logger.warning(f"Failed to check backup settings: {str(e)}")
        return {
            'continuous_backups_status': 'UNKNOWN',
            'error': str(e)
        }

def verify_data_integrity(table_name: str) -> Dict[str, Any]:
    """
    データ整合性の検証
    """
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        # 基本的なデータ整合性チェック
        integrity_checks = []
        integrity_score = 0
        
        # テーブルアクセス確認
        try:
            table_info = table.Table()
            integrity_score += 25
            integrity_checks.append({
                'check': 'table_access',
                'status': 'PASS',
                'message': 'Table is accessible'
            })
        except Exception as e:
            integrity_checks.append({
                'check': 'table_access',
                'status': 'FAIL',
                'message': f'Table access failed: {str(e)}'
            })
        
        # サンプルデータの存在確認
        try:
            response = table.scan(Limit=5)
            items = response.get('Items', [])
            item_count = len(items)
            
            if item_count > 0:
                integrity_score += 25
                integrity_checks.append({
                    'check': 'sample_data',
                    'status': 'PASS',
                    'message': f'Found {item_count} sample items'
                })
            else:
                integrity_checks.append({
                    'check': 'sample_data',
                    'status': 'WARN',
                    'message': 'No data found in table'
                })
                
        except Exception as e:
            integrity_checks.append({
                'check': 'sample_data',
                'status': 'FAIL',
                'message': f'Data scan failed: {str(e)}'
            })
        
        # 勘定系データの確認
        try:
            # アカウント情報の確認
            account_response = table.scan(
                FilterExpression='attribute_exists(account_id)',
                Limit=10
            )
            accounts_found = len(account_response.get('Items', []))
            
            if accounts_found > 0:
                integrity_score += 25
                integrity_checks.append({
                    'check': 'account_data',
                    'status': 'PASS',
                    'message': f'Found {accounts_found} account records'
                })
            else:
                integrity_checks.append({
                    'check': 'account_data',
                    'status': 'WARN',
                    'message': 'No account data found'
                })
                
        except Exception as e:
            integrity_checks.append({
                'check': 'account_data',
                'status': 'FAIL',
                'message': f'Account data check failed: {str(e)}'
            })
        
        # トランザクションデータの確認
        try:
            transaction_response = table.scan(
                FilterExpression='attribute_exists(transaction_id)',
                Limit=10
            )
            transactions_found = len(transaction_response.get('Items', []))
            
            if transactions_found > 0:
                integrity_score += 25
                integrity_checks.append({
                    'check': 'transaction_data',
                    'status': 'PASS',
                    'message': f'Found {transactions_found} transaction records'
                })
            else:
                integrity_checks.append({
                    'check': 'transaction_data',
                    'status': 'WARN',
                    'message': 'No transaction data found'
                })
                
        except Exception as e:
            integrity_checks.append({
                'check': 'transaction_data',
                'status': 'FAIL',
                'message': f'Transaction data check failed: {str(e)}'
            })
        
        return {
            'table_name': table_name,
            'integrity_score': integrity_score,
            'max_score': 100,
            'status': 'PASS' if integrity_score >= 75 else 'WARN' if integrity_score >= 50 else 'FAIL',
            'checks': integrity_checks
        }
        
    except Exception as e:
        logger.error(f"Data integrity verification failed: {str(e)}")
        return {
            'table_name': table_name,
            'status': 'ERROR',
            'error': str(e)
        }

def verify_initial_data_setup(table_name: str) -> Dict[str, Any]:
    """
    初期データ設定の確認（Activeリージョン情報など）
    """
    try:
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)
        
        # システム設定データの確認
        setup_checks = []
        
        # Activeリージョン設定の確認
        try:
            response = table.scan(
                FilterExpression='attribute_exists(active_region)',
                Limit=5
            )
            
            active_region_items = response.get('Items', [])
            
            if active_region_items:
                # 東京リージョンがPrimaryに設定されているか確認
                tokyo_primary = any(
                    item.get('active_region') == 'ap-northeast-1' and 
                    item.get('is_primary', False) 
                    for item in active_region_items
                )
                
                if tokyo_primary:
                    setup_checks.append({
                        'check': 'active_region_setup',
                        'status': 'PASS',
                        'message': 'Tokyo region configured as primary'
                    })
                else:
                    setup_checks.append({
                        'check': 'active_region_setup',
                        'status': 'WARN',
                        'message': 'Tokyo region not set as primary'
                    })
            else:
                setup_checks.append({
                    'check': 'active_region_setup',
                    'status': 'WARN',
                    'message': 'No active region configuration found'
                })
                
        except Exception as e:
            setup_checks.append({
                'check': 'active_region_setup',
                'status': 'FAIL',
                'message': f'Active region check failed: {str(e)}'
            })
        
        # システム初期化フラグの確認
        try:
            response = table.scan(
                FilterExpression='attribute_exists(system_initialized)',
                Limit=1
            )
            
            init_items = response.get('Items', [])
            
            if init_items and init_items[0].get('system_initialized', False):
                setup_checks.append({
                    'check': 'system_initialization',
                    'status': 'PASS',
                    'message': 'System initialization completed'
                })
            else:
                setup_checks.append({
                    'check': 'system_initialization',
                    'status': 'WARN',
                    'message': 'System initialization not completed'
                })
                
        except Exception as e:
            setup_checks.append({
                'check': 'system_initialization',
                'status': 'FAIL',
                'message': f'System initialization check failed: {str(e)}'
            })
        
        # 総合評価
        pass_count = sum(1 for check in setup_checks if check['status'] == 'PASS')
        total_checks = len(setup_checks)
        
        if total_checks == 0:
            overall_status = 'NO_CHECKS'
        elif pass_count == total_checks:
            overall_status = 'PASS'
        elif pass_count > 0:
            overall_status = 'PARTIAL'
        else:
            overall_status = 'FAIL'
        
        return {
            'table_name': table_name,
            'status': overall_status,
            'checks': setup_checks,
            'pass_count': pass_count,
            'total_checks': total_checks
        }
        
    except Exception as e:
        logger.error(f"Initial data setup verification failed: {str(e)}")
        return {
            'table_name': table_name,
            'status': 'ERROR',
            'error': str(e)
        }

def determine_overall_status(restore_status, table_status, global_table_status, 
                           data_integrity, initial_data_check) -> str:
    """
    総合的な状態判定
    """
    try:
        # リストアジョブの状態確認
        if restore_status and restore_status.get('status') not in ['COMPLETED', 'ERROR']:
            return 'IN_PROGRESS'
        
        if restore_status and restore_status.get('status') == 'ERROR':
            return 'FAILED'
        
        # テーブルの状態確認
        if not table_status or table_status.get('status') != 'ACTIVE':
            return 'NOT_READY'
        
        # データ整合性チェック
        if data_integrity and data_integrity.get('status') == 'FAIL':
            return 'INTEGRITY_FAILED'
        
        # Global Table設定の確認（警告レベル）
        if global_table_status and global_table_status.get('status') == 'ERROR':
            return 'GLOBAL_TABLE_ERROR'
        
        # 初期データ設定の確認（警告レベル）
        if initial_data_check and initial_data_check.get('status') == 'FAIL':
            return 'SETUP_INCOMPLETE'
        
        return 'READY'
        
    except Exception as e:
        logger.error(f"Overall status determination failed: {str(e)}")
        return 'ERROR'
`),
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
  }
}
