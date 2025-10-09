import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';

export interface KmsConstructProps {
  /**
   * KMSキーの説明
   */
  description: string;
  /**
   * KMSキーのエイリアス名
   */
  alias: string;
  /**
   * キーの削除待機期間（日数）
   * @default 30
   */
  removalPolicy?: cdk.RemovalPolicy;
  /**
   * 追加のキー管理者ARN
   */
  additionalKeyAdmins?: string[];
  /**
   * 追加のキー使用者ARN
   */
  additionalKeyUsers?: string[];
}

/**
 * FISC安全対策基準対応のKMSカスタマー管理キー構成
 *
 * 対応する実務基準:
 * - 実3: 暗号化対策
 * - 実13: 暗号化鍵管理
 * - 実30: 暗号化鍵管理
 * - 実69: データ分類・保護
 */
export class KmsConstruct extends Construct {
  public readonly key: kms.Key;
  public readonly keyAlias: kms.Alias;

  constructor(scope: Construct, id: string, props: KmsConstructProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);

    // KMSキーポリシー: 職掌分離を考慮した設計
    const keyPolicy = new iam.PolicyDocument({
      statements: [
        // ルートアカウントによる完全な管理権限
        new iam.PolicyStatement({
          sid: 'EnableRootAccountAccess',
          effect: iam.Effect.ALLOW,
          principals: [new iam.AccountRootPrincipal()],
          actions: ['kms:*'],
          resources: ['*'],
        }),
        // キー管理者権限（暗号化鍵の管理者とデータ所有者を分離）
        new iam.PolicyStatement({
          sid: 'AllowKeyAdministration',
          effect: iam.Effect.ALLOW,
          principals: [
            // デフォルト: CloudFormationサービスロール
            new iam.ServicePrincipal('cloudformation.amazonaws.com'),
            // 追加の管理者があれば追加
            ...(props.additionalKeyAdmins?.map((arn) => new iam.ArnPrincipal(arn)) || []),
          ],
          actions: [
            'kms:Create*',
            'kms:Describe*',
            'kms:Enable*',
            'kms:List*',
            'kms:Put*',
            'kms:Update*',
            'kms:Revoke*',
            'kms:Disable*',
            'kms:Get*',
            'kms:Delete*',
            'kms:TagResource',
            'kms:UntagResource',
            'kms:ScheduleKeyDeletion',
            'kms:CancelKeyDeletion',
          ],
          resources: ['*'],
        }),
        // キー使用権限（データの暗号化・復号化）
        new iam.PolicyStatement({
          sid: 'AllowKeyUsage',
          effect: iam.Effect.ALLOW,
          principals: [
            // AWSサービス（DynamoDB、S3、Lambda等）
            new iam.ServicePrincipal('dynamodb.amazonaws.com'),
            new iam.ServicePrincipal('s3.amazonaws.com'),
            new iam.ServicePrincipal('lambda.amazonaws.com'),
            new iam.ServicePrincipal('sqs.amazonaws.com'),
            new iam.ServicePrincipal('logs.amazonaws.com'),
            // 追加の使用者があれば追加
            ...(props.additionalKeyUsers?.map((arn) => new iam.ArnPrincipal(arn)) || []),
          ],
          actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
          resources: ['*'],
        }),
        // Grant権限（AWSサービスがキーへのアクセス許可を作成）
        new iam.PolicyStatement({
          sid: 'AllowAttachmentOfPersistentResources',
          effect: iam.Effect.ALLOW,
          principals: [
            new iam.ServicePrincipal('dynamodb.amazonaws.com'),
            new iam.ServicePrincipal('s3.amazonaws.com'),
            new iam.ServicePrincipal('lambda.amazonaws.com'),
            new iam.ServicePrincipal('sqs.amazonaws.com'),
            new iam.ServicePrincipal('logs.amazonaws.com'),
          ],
          actions: ['kms:CreateGrant', 'kms:ListGrants', 'kms:RevokeGrant'],
          resources: ['*'],
          conditions: {
            Bool: {
              'kms:GrantIsForAWSResource': 'true',
            },
          },
        }),
        // カスタムリソース用Lambda関数のKMSアクセス権限
        new iam.PolicyStatement({
          sid: 'AllowCustomResourceAccess',
          effect: iam.Effect.ALLOW,
          principals: [new iam.AccountRootPrincipal()],
          actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'kms:ViaService': [`dynamodb.${stack.region}.amazonaws.com`],
            },
          },
        }),
        // Lambda関数の直接的なKMSアクセス権限
        new iam.PolicyStatement({
          sid: 'AllowLambdaDirectAccess',
          effect: iam.Effect.ALLOW,
          principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
          actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:SourceAccount': stack.account,
            },
          },
        }),
      ],
    });

    // KMSカスタマー管理キーの作成
    this.key = new kms.Key(this, 'Key', {
      description: props.description,
      policy: keyPolicy,
      // 自動キーローテーションを有効化（FISC実務基準30対応）
      enableKeyRotation: true,
      // 削除保護期間の設定
      removalPolicy: props.removalPolicy || cdk.RemovalPolicy.RETAIN,
      // キーの削除待機期間（最小7日、デフォルト30日）
      pendingWindow: cdk.Duration.days(30),
    });

    // キーエイリアスの作成
    this.keyAlias = new kms.Alias(this, 'KeyAlias', {
      aliasName: props.alias,
      targetKey: this.key,
    });

    // CDK Nag抑制: KMSキーポリシーのワイルドカード権限
    NagSuppressions.addResourceSuppressions(this.key, [
      {
        id: 'AwsSolutions-KMS5',
        reason:
          'KMSキーポリシーでは、キー管理とデータアクセスの職掌分離を実現するため、適切なプリンシパルに対してワイルドカード権限を付与しています。これはFISC安全対策基準の暗号化鍵管理要件に準拠した設計です。',
      },
    ]);

    // タグ付け（管理・監査用）
    cdk.Tags.of(this.key).add('Purpose', 'FISC-Compliance');
    cdk.Tags.of(this.key).add('KeyRotation', 'Enabled');
    cdk.Tags.of(this.key).add('Environment', stack.stackName);
  }
}
