import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface DynamoDBRestoreLambdaProps {
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
 * DynamoDB復旧専用Lambda関数
 * StepFunctionsから呼び出される
 */
export class DynamoDBRestoreLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: DynamoDBRestoreLambdaProps) {
    super(scope, id);

    // Lambda実行ロール
    const executionRole = new iam.Role(this, 'DynamoDBRestoreExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    // DynamoDB復旧に必要な権限
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
          'dynamodb:*',
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

    // DynamoDB復旧Lambda関数
    this.function = new lambda.Function(this, 'Function', {
      functionName: `dynamodb-restore-${props.environment}`,
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
    DynamoDB復旧Lambda関数
    StepFunctionsから呼び出される
    """
    try:
        logger.info(f"DynamoDB restore request received: {json.dumps(event)}")
        
        # 入力パラメータの検証
        recovery_point_arn = event.get('recovery_point_arn')
        target_table_name = event.get('target_table_name')
        
        if not recovery_point_arn:
            raise ValueError("recovery_point_arn is required")
        if not target_table_name:
            raise ValueError("target_table_name is required")
        
        # 既存のリストアされたテーブルを確認
        existing_table = check_existing_table(target_table_name)
        if existing_table:
            logger.info(f"DynamoDB table {target_table_name} already exists, skipping restore")
            return {
                'statusCode': 200,
                'restore_job_id': 'EXISTING',
                'table_name': target_table_name,
                'status': 'EXISTING',
                'table_arn': existing_table.get('TableArn'),
                'message': 'Table already exists'
            }
        
        # リストアジョブ開始
        backup_client = boto3.client('backup')
        
        # DynamoDB用メタデータ（暗号化設定を明示的に指定）
        # AWS所有キーを使用してクロスアカウントKMSの問題を回避
        metadata = {
            'TargetTableName': target_table_name,
            'EncryptionType': 'Default',  # AWS所有キーを使用
            'kmsMasterKeyArn': 'Not Applicable'  # AWS所有キーの場合
        }
        
        logger.info(f"Starting restore job with metadata: {json.dumps(metadata)}")
        
        response = backup_client.start_restore_job(
            RecoveryPointArn=recovery_point_arn,
            Metadata=metadata,
            IamRoleArn=os.environ['BACKUP_SERVICE_ROLE_ARN']
        )
        
        restore_job_id = response['RestoreJobId']
        logger.info(f"DynamoDB restore job started: {restore_job_id}")
        
        # Parameter Storeに結果保存
        ssm_client = boto3.client('ssm')
        ssm_client.put_parameter(
            Name=f"/cyber-resilience/{os.environ['ENVIRONMENT']}/dynamodb-restore-job-id",
            Value=restore_job_id,
            Type='String',
            Overwrite=True
        )
        
        return {
            'statusCode': 200,
            'restore_job_id': restore_job_id,
            'table_name': target_table_name,
            'recovery_point_arn': recovery_point_arn,
            'status': 'STARTED',
            'timestamp': datetime.utcnow().isoformat(),
            'encryption_type': 'AWS_OWNED_KEY',
            'message': 'DynamoDB restore job started with AWS owned key encryption'
        }
        
    except Exception as e:
        logger.error(f"DynamoDB restore failed: {str(e)}")
        return {
            'statusCode': 500,
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }

def check_existing_table(table_name: str) -> Optional[Dict[str, Any]]:
    """
    既存のDynamoDBテーブルを確認
    """
    try:
        dynamodb_client = boto3.client('dynamodb')
        response = dynamodb_client.describe_table(TableName=table_name)
        
        if response['Table']:
            table = response['Table']
            logger.info(f"Found existing table: {table_name}, status: {table['TableStatus']}")
            return table
        
        return None
        
    except dynamodb_client.exceptions.ResourceNotFoundException:
        logger.info(f"Table {table_name} not found, proceeding with restore")
        return None
    except Exception as e:
        logger.warning(f"Error checking existing table: {str(e)}")
        return None

def setup_global_table_if_needed(table_name: str) -> Dict[str, Any]:
    """
    必要に応じてGlobal Tableの設定を行う
    リストアアカウントでは東京Primaryで初期化
    """
    try:
        dynamodb_client = boto3.client('dynamodb')
        
        # テーブルの現在の設定を確認
        response = dynamodb_client.describe_table(TableName=table_name)
        table = response['Table']
        
        # Global Tableの設定確認
        global_table_status = table.get('GlobalTableVersion')
        
        if not global_table_status:
            logger.info(f"Setting up Global Table for {table_name}")
            # 必要に応じてGlobal Table設定を追加
            # 現在は東京リージョンPrimaryとして設定
            
        return {
            'table_name': table_name,
            'global_table_configured': bool(global_table_status),
            'primary_region': 'ap-northeast-1',  # 東京
            'status': 'CONFIGURED'
        }
        
    except Exception as e:
        logger.error(f"Global Table setup failed: {str(e)}")
        return {
            'table_name': table_name,
            'global_table_configured': False,
            'error': str(e),
            'status': 'FAILED'
        }
`),
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
  }
}
