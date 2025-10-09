import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface IAMBackupServiceRoleProps {
  /**
   * データバンカーアカウントID
   */
  dataVaultAccountId: string;
  /**
   * 共有バックアップボルト名
   */
  sharedBackupVaultName: string;
  /**
   * 環境名
   */
  environment: string;
}

export class IAMBackupServiceRole extends Construct {
  public readonly role: iam.Role;
  public readonly roleArn: string;

  constructor(scope: Construct, id: string, props: IAMBackupServiceRoleProps) {
    super(scope, id);

    // サイバーレジリエンス専用バックアップサービスロール
    this.role = new iam.Role(this, 'CyberResilienceBackupServiceRole', {
      roleName: 'CyberResilienceBackupServiceRole',
      description: 'Service role for cyber resilience backup and restore operations with enhanced permissions',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('backup.amazonaws.com'),
        new iam.ServicePrincipal('rds.amazonaws.com'),
        new iam.ServicePrincipal('dynamodb.amazonaws.com'),
        // データバンカーアカウントからの AssumeRole を許可
        new iam.AccountPrincipal(props.dataVaultAccountId).withConditions({
          StringEquals: {
            'sts:ExternalId': 'cyber-resilience-restore',
          },
        }),
      ),
      maxSessionDuration: cdk.Duration.hours(12), // 長時間の復旧作業に対応
    });

    // Logically Air-Gapped VaultのAWS owned key対応のため
    this.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

    // 標準的なAWS Backupポリシーも追加（ベストプラクティス）
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup'),
    );
    this.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForRestores'),
    );

    // 拡張KMSアクセスポリシー
    const enhancedKMSPolicy = new iam.Policy(this, 'EnhancedKMSCrossAccountAccess', {
      policyName: 'EnhancedKMSCrossAccountAccess',
      statements: [
        new iam.PolicyStatement({
          sid: 'EnhancedKMSCrossAccountAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Decrypt',
            'kms:DescribeKey',
            'kms:GenerateDataKey',
            'kms:GenerateDataKeyWithoutPlaintext',
            'kms:CreateGrant',
            'kms:RetireGrant',
            'kms:ReEncrypt*',
            'kms:GetKeyPolicy',
            'kms:GetKeyRotationStatus',
            'kms:ListAliases',
            'kms:ListGrants',
            'kms:ListKeys',
            'kms:ListResourceTags',
          ],
          resources: [
            // データバンカーアカウントのKMSキー
            `arn:aws:kms:*:${props.dataVaultAccountId}:key/*`,
            // AWS owned keys (Logically Air-Gapped Vault用)
            'arn:aws:kms:*:*:key/*',
          ],
        }),
        new iam.PolicyStatement({
          sid: 'KMSServiceAccess',
          effect: iam.Effect.ALLOW,
          actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': [
                'backup.ap-northeast-1.amazonaws.com',
                'rds.ap-northeast-1.amazonaws.com',
                'dynamodb.ap-northeast-1.amazonaws.com',
              ],
            },
          },
        }),
      ],
    });

    this.role.attachInlinePolicy(enhancedKMSPolicy);

    // 勘定系ワークロード接続テスト用権限
    const workloadTestPolicy = new iam.Policy(this, 'WorkloadConnectionTestPolicy', {
      policyName: 'WorkloadConnectionTestPolicy',
      statements: [
        new iam.PolicyStatement({
          sid: 'DynamoDBWorkloadTest',
          effect: iam.Effect.ALLOW,
          actions: [
            'dynamodb:Scan',
            'dynamodb:Query',
            'dynamodb:GetItem',
            'dynamodb:DescribeTable',
            'dynamodb:ListTables',
          ],
          resources: ['arn:aws:dynamodb:*:*:table/restore-*', 'arn:aws:dynamodb:*:*:table/cyber-resilience-*'],
        }),
        new iam.PolicyStatement({
          sid: 'RDSWorkloadTest',
          effect: iam.Effect.ALLOW,
          actions: ['rds:DescribeDBClusters', 'rds:DescribeDBInstances', 'rds:DescribeDBClusterEndpoints'],
          resources: ['arn:aws:rds:*:*:cluster:restore-*', 'arn:aws:rds:*:*:cluster:cyber-resilience-*'],
        }),
      ],
    });

    this.role.attachInlinePolicy(workloadTestPolicy);

    this.roleArn = this.role.roleArn;

    // Parameter Storeにロール情報を保存（動的ARNのみ）
    new ssm.StringParameter(this, 'BackupServiceRoleArn', {
      parameterName: `/cyber-resilience/${props.environment}/backup-service-role-arn`,
      stringValue: this.roleArn,
      description: 'ARN of the cyber resilience backup service role',
      tier: ssm.ParameterTier.STANDARD,
    });

    // 注意: ロール名は固定値のため、Parameter Storeへの保存を削除
    // 必要な場合はparameter.tsから直接参照可能

    // CloudFormation出力（重複回避のため出力名変更）
    new cdk.CfnOutput(this, 'CyberResilienceBackupServiceRoleArn', {
      value: this.roleArn,
      description: 'ARN of the cyber resilience backup service role',
      exportName: `${cdk.Stack.of(this).stackName}-CyberResilienceBackupServiceRoleArn`,
    });

    new cdk.CfnOutput(this, 'CyberResilienceBackupServiceRoleName', {
      value: this.role.roleName,
      description: 'Name of the cyber resilience backup service role',
      exportName: `${cdk.Stack.of(this).stackName}-BackupServiceRoleName`,
    });
  }
}
