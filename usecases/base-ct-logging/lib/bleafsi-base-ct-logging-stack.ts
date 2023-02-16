import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/*
 * CloudTrail S3 Data Event用の ログ集約S3バケットを作成
 */
export class BaseCTStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // 集約ログ用のバケット作成
    const logBucket = new BucketForConsolidatedLoggging(this, 'Bucket');

    //CFn output
    new cdk.CfnOutput(this, 'Conslidated Log Bucket', {
      value: logBucket.bucket.bucketName,
      description: 'Bucket for CloudTrail log',
    });
  }
}

/////////// private Construct /////////////////
/*
 *  集約ログ用 S3バケット作成
 */
class BucketForConsolidatedLoggging extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // 1 アクセスログ バケット作成
    const accessLogsBucket = new AccessLogsBucket(this, 'AccessLogs');

    // 2 集約ログ用のバケット作成
    const bucket = new s3.Bucket(this, 'Default', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket.bucket,
    });
    //オブジェクトの削除を禁止するポリシー追加
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [bucket.arnForObjects('*')],
      }),
    );

    // 3 S3リソースポリシーの設定
    const inlineIamPolicy1 = new iam.PolicyStatement({
      sid: 'AWSBucketPermissions',
      effect: iam.Effect.ALLOW,
      resources: [bucket.bucketArn],
      principals: [
        new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
        new iam.ServicePrincipal('config.amazonaws.com'),
      ],
      actions: ['s3:GetBucketAcl', 's3:ListBucket'],
    });
    bucket.addToResourcePolicy(inlineIamPolicy1);

    const inlineIamPolicy2 = new iam.PolicyStatement({
      sid: 'AWSBucketDelivery',
      effect: iam.Effect.ALLOW,
      resources: [`${bucket.bucketArn}/*/*`],
      principals: [
        new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
        new iam.ServicePrincipal('config.amazonaws.com'),
      ],
      actions: ['s3:PutObject'],
      conditions: {
        StringEquals: {
          's3:x-amz-acl': 'bucket-owner-full-control',
        },
      },
    });
    bucket.addToResourcePolicy(inlineIamPolicy2);

    this.bucket = bucket;
  }
}

/*
 * アクセスログ用のバケット作成
 */
class AccessLogsBucket extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new s3.Bucket(this, 'Default', {
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(2555),
          transitions: [
            {
              transitionAfter: cdk.Duration.days(90),
              storageClass: s3.StorageClass.GLACIER,
            },
          ],
        },
      ],
    });

    //オブジェクトの削除を禁止するポリシー追加
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [bucket.arnForObjects('*')],
      }),
    );

    this.bucket = bucket;
  }
}
