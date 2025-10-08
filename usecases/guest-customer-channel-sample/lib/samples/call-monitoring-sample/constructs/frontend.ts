import { CfnOutput, Stack, RemovalPolicy, Duration, IgnoreMode } from 'aws-cdk-lib';
import { Auth } from './auth';
import { Api } from './api';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket } from 'aws-cdk-lib/aws-s3';
import { PrivateBucket } from '../../../constructs/s3-private-bucket';
import { NodejsBuild } from 'deploy-time-build';
import { Construct } from 'constructs';
import * as path from 'path';
import { NagSuppressions } from 'cdk-nag';
import {
  getPackageJsonIncludePatterns,
  getHierarchicalIncludePatterns,
  getAllIncludePatterns,
} from '../../../constructs/glob-patterns';

export interface Props {
  auth: Auth;
  api: Api;
  webAclId: string;
  connectUrl: string;
}

export class Frontend extends Construct {
  readonly cloudFrontWebDistribution: cloudfront.Distribution;
  readonly frontendUrl: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    // cdk.json から connectUrl を取得
    const connectUrl = props.connectUrl;

    const assetAccessLogBucket = new PrivateBucket(this, 'AssetAccessLogBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });
    /**
     * 静的ファイルを置く S3 バケットを作成
     */
    const assetBucket = new Bucket(this, 'AssetBucket', {
      // バケット名は一意である必要があるため自動で生成した名前を使用します
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsBucket: assetAccessLogBucket,
      serverAccessLogsPrefix: 'access-log/bucket/',
    });

    /*
     * CloudFront ディストリビューションを作成
     */
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'Web app for Connect GenAI Monitor',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(assetBucket),
      },
      defaultRootObject: 'index.html',
      // 404 Not Found エラーの場合はルートにリダイレクトします
      errorResponses: [
        {
          httpStatus: 404,
          ttl: Duration.seconds(0),
          responseHttpStatus: 200,
          responsePagePath: '/',
        },
      ],

      // 価格クラスに日本が含まれる 200 を選択します
      // https://docs.aws.amazon.com/ja_jp/AmazonCloudFront/latest/DeveloperGuide/PriceClass.html
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,

      // アクセスを日本の IP アドレスからのみに制限します (プロトタイプ用の設定)
      geoRestriction: cloudfront.GeoRestriction.allowlist('JP'),

      // WAF の WebACL を設定します
      webAclId: props.webAclId,

      logBucket: assetAccessLogBucket,
      logFilePrefix: 'access-log/cloudfront/',
      logIncludesCookies: true,
    });
    NagSuppressions.addResourceSuppressions(
      distribution,
      [
        {
          id: 'AwsSolutions-CFR4',
          reason: 'This example uses default CloudFront certificate for testing.',
        },
      ],
      true,
    );

    /**
     * フロントエンドコードをビルドして S3 にデプロイ
     */
    const projectRoot = path.resolve(__dirname, '../../../../../../');
    const frontendPath = 'usecases/guest-customer-channel-sample/lib/samples/call-monitoring-sample/frontend';
    const frontendDistPath = frontendPath + '/dist';

    const reactBuild = new NodejsBuild(this, 'ReactBuild', {
      assets: [
        {
          path: projectRoot,
          exclude: [
            '*',
            '.*',
            ...getHierarchicalIncludePatterns(frontendPath),
            ...getAllIncludePatterns(frontendPath),
            frontendDistPath,
            ...getPackageJsonIncludePatterns(projectRoot),
          ],
          commands: ['npm ci'],
        },
      ],
      buildCommands: ['npm run -w frontend build'],

      // フロントエンドコードで参照される環境変数
      buildEnvironment: {
        VITE_USERPOOL_ID: props.auth.userPool.userPoolId,
        VITE_USERPOOL_CLIENT_ID: props.auth.userPoolClient.userPoolClientId,
        VITE_APPSYNC_API: props.api.graphqlUrl,
        VITE_REGION: Stack.of(this).region,
        VITE_CONNECT_URL: connectUrl,
      },
      destinationBucket: assetBucket,
      distribution,
      outputSourceDirectory: frontendDistPath,
    });
    this.cloudFrontWebDistribution = distribution;
    NagSuppressions.addResourceSuppressions(
      reactBuild,
      [
        { id: 'AwsSolutions-IAM5', reason: 'NodejsBuild uses wildcard permission' },
        { id: 'AwsSolutions-CB4', reason: 'NodejsBuild uses CodeBuild without AWS KMS key' },
      ],
      true,
    );

    if (connectUrl) {
      new CfnOutput(this, 'AmazonConnectUrl', { value: connectUrl });
    }
    this.frontendUrl = `https://${distribution.distributionDomainName}`;
    new CfnOutput(this, 'FrontendUrl', { value: this.frontendUrl });
  }
}
