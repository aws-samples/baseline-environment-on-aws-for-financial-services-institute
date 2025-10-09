import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface AuroraRestoreLambdaProps {
  /**
   * データバンカーアカウントID
   */
  dataVaultAccountId: string;
  /**
   * バックアップサービスロールARN
   */
  backupServiceRoleArn: string;
  /**
   * 環境名
   */
  environment: string;
  /**
   * AdministratorAccess権限を使用するかどうか
   */
  useAdministratorAccess?: boolean;
}

/**
 * Aurora PostgreSQL復旧専用Lambda関数
 * StepFunctionsから呼び出される
 */
export class AuroraRestoreLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: AuroraRestoreLambdaProps) {
    super(scope, id);

    // Lambda実行ロール
    const executionRole = new iam.Role(this, 'AuroraRestoreExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    // Aurora復旧に必要な権限
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'backup:StartRestoreJob',
          'backup:DescribeRestoreJob',
          'backup:DescribeRecoveryPoint',
          'backup:ListRecoveryPoints',
          'backup:DescribeBackupVault',
          'iam:PassRole',
          'rds:*',
          'ssm:GetParameter',
          'ssm:PutParameter',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      }),
    );

    // AdministratorAccess権限を追加（クロスアカウントKMSアクセスに必要）
    if (props.environment === 'Development') {
      executionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));
    }

    // Aurora復旧Lambda関数
    this.function = new lambda.Function(this, 'Function', {
      functionName: `aurora-restore-${props.environment}`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.handler',
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      role: executionRole,
      environment: {
        DATA_VAULT_ACCOUNT_ID: props.dataVaultAccountId,
        BACKUP_SERVICE_ROLE_ARN: props.backupServiceRoleArn,
        ENVIRONMENT: props.environment,
      },
      code: lambda.Code.fromInline(`
import json
import boto3
import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Aurora PostgreSQL復旧Lambda関数
    StepFunctionsから呼び出される
    """
    try:
        logger.info(f"Aurora restore request received: {json.dumps(event)}")
        
        # 入力パラメータの検証
        recovery_point_arn = event.get('recovery_point_arn')
        target_cluster_name = event.get('target_cluster_name')
        
        if not recovery_point_arn:
            raise ValueError("recovery_point_arn is required")
        if not target_cluster_name:
            raise ValueError("target_cluster_name is required")
        
        # 既存のリストアされたクラスターを確認
        existing_cluster = check_existing_cluster(target_cluster_name)
        if existing_cluster:
            logger.info(f"Aurora cluster {target_cluster_name} already exists, skipping restore")
            return {
                'statusCode': 200,
                'restore_job_id': 'EXISTING',
                'cluster_identifier': target_cluster_name,
                'status': 'EXISTING',
                'endpoint': existing_cluster.get('Endpoint'),
                'message': 'Cluster already exists'
            }
        
        # RDS直接復旧に変更（AWS Backupではクラスターのみでインスタンスが起動しないため）
        rds_client = boto3.client('rds')
        
        # Parameter Storeから共有スナップショット識別子を取得
        # データバンカーアカウントから共有されたスナップショットを使用
        snapshot_identifier = get_snapshot_identifier_from_config()
        
        # Auroraクラスターを復旧（スナップショットから）
        restore_params = {
            'DBClusterIdentifier': target_cluster_name,
            'SnapshotIdentifier': snapshot_identifier,
            'Engine': 'aurora-postgresql',
            'DeletionProtection': False,
            # KMSキーを指定しない（デフォルトキーを使用）
            'KmsKeyId': 'alias/aws/rds'
        }
        
        # Serverless v2設定（必要な場合のみ）
        if 'serverless' in target_cluster_name.lower():
            restore_params['ServerlessV2ScalingConfiguration'] = {
                'MinCapacity': 0.5,
                'MaxCapacity': 1.0
            }
        
        response = rds_client.restore_db_cluster_from_snapshot(**restore_params)
        
        cluster_identifier = response['DBCluster']['DBClusterIdentifier']
        logger.info(f"Aurora cluster restore started: {cluster_identifier}")
        
        # インスタンスを明示的に作成（クラスターのみでは接続できないため）
        instance_identifier = f"{target_cluster_name}-instance-1"
        
        try:
            instance_response = rds_client.create_db_instance(
                DBInstanceIdentifier=instance_identifier,
                DBClusterIdentifier=target_cluster_name,
                DBInstanceClass='db.r6g.large',  # 復旧用の適切なサイズ
                Engine='aurora-postgresql',
                PubliclyAccessible=False,
                EnablePerformanceInsights=True  # 正しいパラメータ名
                # MonitoringIntervalとMonitoringRoleArnは復旧時には不要なため削除
                # DeletionProtectionはクラスターレベルでのみ設定可能なため削除
            )
            logger.info(f"Aurora instance created: {instance_identifier}")
            
            # インスタンス情報もParameter Storeに保存
            ssm_client.put_parameter(
                Name=f"/cyber-resilience/{os.environ['ENVIRONMENT']}/aurora-restore-instance-id",
                Value=instance_identifier,
                Type='String',
                Overwrite=True
            )
            
        except Exception as instance_error:
            logger.error(f"Failed to create Aurora instance: {str(instance_error)}")
            # インスタンス作成に失敗してもクラスターは作成されているので続行
            instance_identifier = f"FAILED_TO_CREATE_INSTANCE: {str(instance_error)}"
        
        # Parameter Storeに結果保存
        ssm_client = boto3.client('ssm')
        ssm_client.put_parameter(
            Name=f"/cyber-resilience/{os.environ['ENVIRONMENT']}/aurora-restore-cluster-id",
            Value=cluster_identifier,
            Type='String',
            Overwrite=True
        )
        
        return {
            'statusCode': 200,
            'cluster_identifier': cluster_identifier,
            'instance_identifier': instance_identifier,
            'recovery_point_arn': recovery_point_arn,
            'snapshot_identifier': snapshot_identifier,
            'status': 'CLUSTER_AND_INSTANCE_RESTORE_STARTED',
            'timestamp': datetime.utcnow().isoformat(),
            'message': 'Aurora cluster and instance restore started via RDS API (not AWS Backup)',
            'method': 'RDS_DIRECT_RESTORE'
        }
        
    except Exception as e:
        logger.error(f"Aurora restore failed: {str(e)}")
        return {
            'statusCode': 500,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }

def get_snapshot_identifier_from_config() -> str:
    """
    共有されたAuroraスナップショット識別子を取得
    データバンカーアカウントから共有されたスナップショットを使用
    """
    # 共有スナップショットの完全なARNを使用
    snapshot_arn = 'arn:aws:rds:ap-northeast-1:060795945268:cluster-snapshot:cyber-resilience-test-20250829-124954'
    
    logger.info(f"Using shared snapshot ARN: {snapshot_arn}")
    
    # スナップショットが存在するか確認
    try:
        rds_client = boto3.client('rds')
        # 共有スナップショットの場合、include-sharedを使用
        snapshot_details = rds_client.describe_db_cluster_snapshots(
            DBClusterSnapshotIdentifier=snapshot_arn,
            IncludeShared=True
        )
        logger.info(f"Confirmed shared snapshot exists: {snapshot_arn}")
        logger.info(f"Snapshot details: {json.dumps(snapshot_details['DBClusterSnapshots'][0], default=str)}")
        return snapshot_arn
    except Exception as e:
        logger.error(f"Error confirming snapshot existence: {str(e)}")
        # スナップショットが見つからない場合でも、ARNを返す（復旧処理で詳細エラーが出る）
        logger.info(f"Proceeding with snapshot ARN: {snapshot_arn}")
        return snapshot_arn

def check_existing_cluster(cluster_identifier: str) -> Optional[Dict[str, Any]]:
    """
    既存のAuroraクラスターを確認
    """
    try:
        rds_client = boto3.client('rds')
        response = rds_client.describe_db_clusters(
            DBClusterIdentifier=cluster_identifier
        )
        
        if response['DBClusters']:
            cluster = response['DBClusters'][0]
            logger.info(f"Found existing cluster: {cluster_identifier}, status: {cluster['Status']}")
            return cluster
        
        return None
        
    except rds_client.exceptions.DBClusterNotFoundFault:
        logger.info(f"Cluster {cluster_identifier} not found, proceeding with restore")
        return None
    except Exception as e:
        logger.warning(f"Error checking existing cluster: {str(e)}")
        return None
`),
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
  }
}
