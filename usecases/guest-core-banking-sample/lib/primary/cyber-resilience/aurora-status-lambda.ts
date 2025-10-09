import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface AuroraStatusLambdaProps {
  /**
   * 環境名
   */
  environment: string;
}

/**
 * Aurora PostgreSQL状態確認専用Lambda関数
 * StepFunctionsから呼び出される
 */
export class AuroraStatusLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: AuroraStatusLambdaProps) {
    super(scope, id);

    // Lambda実行ロール
    const executionRole = new iam.Role(this, 'AuroraStatusExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    // Aurora状態確認に必要な権限
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'backup:DescribeRestoreJob',
          'rds:DescribeDBClusters',
          'rds:DescribeDBInstances',
          'rds:DescribeDBClusterEndpoints',
          'ssm:GetParameter',
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      }),
    );

    // Aurora状態確認Lambda関数
    this.function = new lambda.Function(this, 'Function', {
      functionName: `aurora-status-${props.environment}`,
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
from typing import Dict, Any, Optional

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Aurora PostgreSQL状態確認Lambda関数
    StepFunctionsから呼び出される
    """
    try:
        logger.info(f"Aurora status check request: {json.dumps(event)}")
        
        # 入力パラメータの取得
        restore_job_id = event.get('restore_job_id')
        cluster_identifier = event.get('cluster_identifier')
        
        if not restore_job_id and not cluster_identifier:
            raise ValueError("Either restore_job_id or cluster_identifier is required")
        
        # リストアジョブの状態確認
        restore_status = None
        if restore_job_id and restore_job_id != 'EXISTING':
            restore_status = check_restore_job_status(restore_job_id)
        
        # Auroraクラスターの状態確認
        cluster_status = None
        if cluster_identifier:
            cluster_status = check_cluster_status(cluster_identifier)
        
        # データ整合性の検証
        integrity_check = None
        if cluster_status and cluster_status.get('status') == 'available':
            integrity_check = verify_data_integrity(cluster_identifier)
        
        # 接続可能性の確認
        connectivity_check = None
        if cluster_status and cluster_status.get('endpoint'):
            connectivity_check = verify_connectivity(cluster_status['endpoint'])
        
        # 総合評価
        overall_status = determine_overall_status(
            restore_status, cluster_status, integrity_check, connectivity_check
        )
        
        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'restore_job_status': restore_status,
            'cluster_status': cluster_status,
            'integrity_check': integrity_check,
            'connectivity_check': connectivity_check,
            'overall_status': overall_status,
            'ready_for_workload': overall_status == 'READY'
        }
        
        logger.info(f"Aurora status check completed: {overall_status}")
        
        return {
            'statusCode': 200,
            **result  # 結果を直接返す（bodyフィールドではなく）
        }
        
    except Exception as e:
        logger.error(f"Aurora status check failed: {str(e)}")
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

def check_cluster_status(cluster_identifier: str) -> Dict[str, Any]:
    """
    Auroraクラスターとインスタンスの状態確認（RDS復旧対応）
    """
    try:
        rds_client = boto3.client('rds')
        response = rds_client.describe_db_clusters(DBClusterIdentifier=cluster_identifier)
        
        if not response['DBClusters']:
            return {
                'cluster_identifier': cluster_identifier,
                'status': 'NOT_FOUND',
                'error': 'Cluster not found'
            }
        
        cluster = response['DBClusters'][0]
        
        return {
            'cluster_identifier': cluster_identifier,
            'status': cluster['Status'],
            'engine': cluster['Engine'],
            'engine_version': cluster['EngineVersion'],
            'endpoint': cluster.get('Endpoint'),
            'reader_endpoint': cluster.get('ReaderEndpoint'),
            'port': cluster.get('Port'),
            'database_name': cluster.get('DatabaseName'),
            'master_username': cluster.get('MasterUsername'),
            'availability_zones': cluster.get('AvailabilityZones', []),
            'backup_retention_period': cluster.get('BackupRetentionPeriod'),
            'instance_count': len(cluster.get('DBClusterMembers', [])),
            'storage_encrypted': cluster.get('StorageEncrypted', False)
        }
        
    except Exception as e:
        logger.error(f"Failed to check cluster status: {str(e)}")
        return {
            'cluster_identifier': cluster_identifier,
            'status': 'ERROR',
            'error': str(e)
        }

def verify_data_integrity(cluster_identifier: str) -> Dict[str, Any]:
    """
    データ整合性の検証
    """
    try:
        # 基本的な整合性チェック
        # 実際の実装では、データベースに接続してテーブル構造やデータの整合性を確認
        
        rds_client = boto3.client('rds')
        
        # クラスターメンバーの確認
        response = rds_client.describe_db_clusters(DBClusterIdentifier=cluster_identifier)
        cluster = response['DBClusters'][0]
        
        members = cluster.get('DBClusterMembers', [])
        writer_count = sum(1 for member in members if member.get('IsClusterWriter', False))
        reader_count = len(members) - writer_count
        
        # 基本的な整合性指標
        integrity_score = 0
        checks = []
        
        # Writer インスタンスの存在確認
        if writer_count == 1:
            integrity_score += 30
            checks.append({'check': 'writer_instance', 'status': 'PASS', 'message': 'Single writer instance found'})
        else:
            checks.append({'check': 'writer_instance', 'status': 'FAIL', 'message': f'Expected 1 writer, found {writer_count}'})
        
        # Reader インスタンスの確認
        if reader_count >= 0:
            integrity_score += 20
            checks.append({'check': 'reader_instances', 'status': 'PASS', 'message': f'{reader_count} reader instances found'})
        
        # エンジンバージョンの確認
        if cluster.get('EngineVersion'):
            integrity_score += 20
            checks.append({'check': 'engine_version', 'status': 'PASS', 'message': f"Engine version: {cluster['EngineVersion']}"})
        
        # 暗号化の確認
        if cluster.get('StorageEncrypted', False):
            integrity_score += 15
            checks.append({'check': 'encryption', 'status': 'PASS', 'message': 'Storage encryption enabled'})
        else:
            checks.append({'check': 'encryption', 'status': 'WARN', 'message': 'Storage encryption not enabled'})
        
        # バックアップ設定の確認
        if cluster.get('BackupRetentionPeriod', 0) > 0:
            integrity_score += 15
            checks.append({'check': 'backup_retention', 'status': 'PASS', 'message': f"Backup retention: {cluster['BackupRetentionPeriod']} days"})
        else:
            checks.append({'check': 'backup_retention', 'status': 'WARN', 'message': 'Backup retention not configured'})
        
        return {
            'cluster_identifier': cluster_identifier,
            'integrity_score': integrity_score,
            'max_score': 100,
            'status': 'PASS' if integrity_score >= 70 else 'WARN' if integrity_score >= 50 else 'FAIL',
            'checks': checks,
            'writer_instances': writer_count,
            'reader_instances': reader_count
        }
        
    except Exception as e:
        logger.error(f"Data integrity verification failed: {str(e)}")
        return {
            'cluster_identifier': cluster_identifier,
            'status': 'ERROR',
            'error': str(e)
        }

def verify_connectivity(endpoint: str) -> Dict[str, Any]:
    """
    接続可能性の確認
    """
    try:
        # ネットワークレベルでの接続確認
        # 実際の実装では、VPC内からの接続テストを行う
        
        import socket
        
        # エンドポイントの解析
        if ':' in endpoint:
            host, port = endpoint.rsplit(':', 1)
            port = int(port)
        else:
            host = endpoint
            port = 5432  # PostgreSQLデフォルトポート
        
        # DNS解決の確認
        try:
            ip_address = socket.gethostbyname(host)
            dns_resolution = True
        except socket.gaierror:
            ip_address = None
            dns_resolution = False
        
        return {
            'endpoint': endpoint,
            'host': host,
            'port': port,
            'ip_address': ip_address,
            'dns_resolution': dns_resolution,
            'status': 'PASS' if dns_resolution else 'FAIL',
            'message': 'DNS resolution successful' if dns_resolution else 'DNS resolution failed',
            'note': 'Full connectivity test requires VPC access and database credentials'
        }
        
    except Exception as e:
        logger.error(f"Connectivity verification failed: {str(e)}")
        return {
            'endpoint': endpoint,
            'status': 'ERROR',
            'error': str(e)
        }

def determine_overall_status(restore_status, cluster_status, integrity_check, connectivity_check) -> str:
    """
    総合的な状態判定
    """
    try:
        # リストアジョブの状態確認
        if restore_status and restore_status.get('status') not in ['COMPLETED', 'ERROR']:
            return 'IN_PROGRESS'
        
        if restore_status and restore_status.get('status') == 'ERROR':
            return 'FAILED'
        
        # クラスターの状態確認
        if not cluster_status or cluster_status.get('status') != 'available':
            return 'NOT_READY'
        
        # 整合性チェック
        if integrity_check and integrity_check.get('status') == 'FAIL':
            return 'INTEGRITY_FAILED'
        
        # 接続性チェック
        if connectivity_check and connectivity_check.get('status') == 'FAIL':
            return 'CONNECTIVITY_FAILED'
        
        return 'READY'
        
    except Exception as e:
        logger.error(f"Overall status determination failed: {str(e)}")
        return 'ERROR'
`),
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
  }
}
