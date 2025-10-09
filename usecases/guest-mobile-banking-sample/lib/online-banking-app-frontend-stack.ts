import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { KmsConstruct } from './constructs/kms-construct';

export type OnlineBankingAppFrontendStackProps = cdk.StackProps;

export class OnlineBankingAppFrontendStack extends cdk.Stack {
  public readonly websiteUrl: string;
  public readonly bucketName: string;
  public readonly bucketArn: string;

  constructor(scope: Construct, id: string, props: OnlineBankingAppFrontendStackProps = {}) {
    super(scope, id, props);

    // KMSカスタマー管理キーの作成（FISC実務基準3,13,30対応）
    const kmsConstruct = new KmsConstruct(this, 'FrontendKms', {
      description: 'Frontend S3 buckets encryption key for FISC compliance',
      alias: 'alias/online-banking-frontend',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
    });

    // S3アクセスログ用バケット
    const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      bucketName: `online-banking-app-frontend-logs-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsConstruct.key,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // CloudFrontログ用にACLアクセスを有効化
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(90), // 90日後に削除
        },
      ],
      // SSL必須のバケットポリシーを追加
      enforceSSL: true,
    });

    // S3バケット（フロントエンド用）
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `online-banking-app-frontend-${this.account}-${this.region}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsConstruct.key,
      versioned: true,
      // S3アクセスログを有効化
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'website-access-logs/',
      // SSL必須のバケットポリシーを追加
      enforceSSL: true,
    });

    // WAF Web ACL for CloudFront (us-east-1リージョンでのみ作成)
    let cloudFrontWebAcl: wafv2.CfnWebACL | undefined;
    if (this.region === 'us-east-1') {
      cloudFrontWebAcl = new wafv2.CfnWebACL(this, 'CloudFrontWebACL', {
        scope: 'CLOUDFRONT', // CloudFront用（us-east-1に作成される）
        defaultAction: { allow: {} },
        rules: [
          {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 1,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: 'CommonRuleSetMetric',
            },
          },
          {
            name: 'AWSManagedRulesKnownBadInputsRuleSet',
            priority: 2,
            overrideAction: { none: {} },
            statement: {
              managedRuleGroupStatement: {
                vendorName: 'AWS',
                name: 'AWSManagedRulesKnownBadInputsRuleSet',
              },
            },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: 'KnownBadInputsRuleSetMetric',
            },
          },
          {
            name: 'GeographicRestrictionRule',
            priority: 3,
            statement: {
              geoMatchStatement: {
                countryCodes: ['JP'], // 日本のみ許可
              },
            },
            action: { allow: {} },
            visibilityConfig: {
              sampledRequestsEnabled: true,
              cloudWatchMetricsEnabled: true,
              metricName: 'GeographicRestrictionRule',
            },
          },
        ],
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'CloudFrontWebACL',
        },
      });
    }

    // CloudFront Distribution
    // Origin Access Control (OAC) を使用 - OAIより新しい推奨方法

    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      comment: `Online Banking App - Frontend (${this.region})`,
      // CloudFrontアクセスログを有効化
      enableLogging: true,
      logBucket: accessLogsBucket,
      logFilePrefix: 'cloudfront-access-logs/',
      logIncludesCookies: false,
      // TLS設定: TLS 1.2以上のみ許可
      domainNames: undefined, // カスタムドメインなし
      certificate: undefined, // デフォルト証明書使用
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      // 地理的制限: 日本のみアクセス許可
      geoRestriction: cloudfront.GeoRestriction.allowlist('JP'),
      // WAF Web ACLを関連付け（us-east-1の場合のみ）
      webAclId: cloudFrontWebAcl?.attrArn,
    });

    // プロパティを設定
    this.websiteUrl = `https://${distribution.distributionDomainName}`;
    this.bucketName = websiteBucket.bucketName;
    this.bucketArn = websiteBucket.bucketArn;

    // WAF Web ACL ARNをSSM Parameter Storeに保存（us-east-1の場合のみ）
    if (cloudFrontWebAcl) {
      new ssm.StringParameter(this, 'CloudFrontWebACLArnParameter', {
        parameterName: '/banking-app/waf/cloudfront-web-acl-arn',
        stringValue: cloudFrontWebAcl.attrArn,
        description: 'CloudFront WAF Web ACL ARN',
      });
    }

    // スタックの出力
    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: this.websiteUrl,
      description: 'Website URL',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.bucketName,
      description: 'Website S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketArn', {
      value: this.bucketArn,
      description: 'Website S3 Bucket ARN',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    // CloudFront WAF Web ACL ARN出力（us-east-1の場合のみ）
    if (cloudFrontWebAcl) {
      new cdk.CfnOutput(this, 'CloudFrontWebACLArn', {
        value: cloudFrontWebAcl.attrArn,
        description: 'CloudFront WAF Web ACL ARN',
      });
    }

    // フロントエンドファイルとconfig.jsonのデプロイ
    const sources = [s3deploy.Source.asset('./lib/frontend/build')];

    // SSM Parameter StoreからAPI エンドポイントとAPI Key値を取得してconfig.jsonを生成
    try {
      const bankingApiEndpoint = ssm.StringParameter.valueForStringParameter(this, '/banking-app/api-endpoint');
      const customerApiKeyValue = ssm.StringParameter.valueForStringParameter(this, '/banking-app/api-keys/customer');
      const adminApiKeyValue = ssm.StringParameter.valueForStringParameter(this, '/banking-app/api-keys/admin');
      const authApiKeyValue = ssm.StringParameter.valueForStringParameter(this, '/banking-app/api-keys/auth');

      const configContent = JSON.stringify(
        {
          REACT_APP_BANKING_API: bankingApiEndpoint,
          REACT_APP_CUSTOMER_API_KEY: customerApiKeyValue,
          REACT_APP_ADMIN_API_KEY: adminApiKeyValue,
          REACT_APP_AUTH_API_KEY: authApiKeyValue,
        },
        null,
        2,
      );

      sources.push(s3deploy.Source.data('config.json', configContent));

      console.log('Frontend will use API endpoint from SSM Parameter Store:', bankingApiEndpoint);
      console.log('Frontend will use API Key values from SSM Parameter Store');
    } catch (error) {
      console.log('SSM Parameter Store values not available, frontend will use local development configuration');
    }

    // フロントエンドファイルのデプロイ
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources,
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // CDK Nag抑制: BucketDeploymentが自動生成するServiceRoleとDefaultPolicyに対する抑制
    // ServiceRoleのAWS管理ポリシー使用に対する抑制
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/${this.stackName}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/Resource`,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason:
            'CDK BucketDeploymentが自動生成するLambda関数は、AWS管理ポリシー（AWSLambdaBasicExecutionRole）を使用してCloudWatch Logsへのアクセスを行います。これはAWS CDKの内部実装による標準的な動作であり、セキュリティ上問題ありません。',
          appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
        },
      ],
    );

    // DefaultPolicyのワイルドカード権限に対する抑制
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/${this.stackName}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/DefaultPolicy/Resource`,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'CDK BucketDeploymentは以下の理由でワイルドカード権限が必要です：1) CDKアセットバケット（cdk-*-assets-*）からのソースファイル取得、2) S3操作の内部実装でワイルドカードアクション（GetObject*, GetBucket*, List*, DeleteObject*, Abort*）が必要、3) CloudFormationカスタムリソースの動的な権限要求、4) KMSカスタマー管理キーでの暗号化処理（ReEncrypt*, GenerateDataKey*）。これらはAWS CDKの内部アーキテクチャによる制約であり、セキュリティ上やむを得ない設計です。',
          appliesTo: [
            'Action::s3:GetObject*',
            'Action::s3:GetBucket*',
            'Action::s3:List*',
            'Resource::arn:<AWS::Partition>:s3:::cdk-hnb659fds-assets-111111111111-ap-northeast-1/*',
            'Action::s3:DeleteObject*',
            'Action::s3:Abort*',
            'Resource::<WebsiteBucket75C24D94.Arn>/*',
            'Resource::*',
            'Action::kms:ReEncrypt*',
            'Action::kms:GenerateDataKey*',
          ],
        },
      ],
    );

    // Lambda関数のランタイムバージョンに対する抑制
    NagSuppressions.addResourceSuppressionsByPath(
      this,
      `/${this.stackName}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/Resource`,
      [
        {
          id: 'AwsSolutions-L1',
          reason:
            'CDK Bucket DeploymentのLambda関数はCDKによって自動管理されており、runtime versionはCDKのバージョンアップ時に更新されます。',
        },
      ],
    );

    // CDK Nag サプレッション: CloudFrontのTLS設定
    NagSuppressions.addResourceSuppressions(distribution, [
      {
        id: 'AwsSolutions-CFR4',
        reason:
          'このリファレンスアーキテクチャではカスタムドメインを利用せず、CloudFrontのデフォルトドメインを使用します。TLS設定はAWSによって管理されます。',
      },
      {
        id: 'AwsSolutions-CFR5',
        reason:
          'このリファレンスアーキテクチャではCloudFrontのデフォルトドメインを使用します。オリジン間通信のTLS設定はAWSによって管理されます。',
      },
    ]);
  }
}
