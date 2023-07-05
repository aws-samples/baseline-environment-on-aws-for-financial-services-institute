import * as cdk from 'aws-cdk-lib';
import { PjPrefix } from '../bin/parameter';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Bucket } from './constructs/bleafsi-s3-bucket';

/*
 * CloudTrail S3 Data Event用の ログ集約S3バケットを作成
 */
export class BaseCTStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // 集約ログ用のバケット作成
    // 必要に応じて removalPolicyは変更する。DESTROYはスタック削除時に自動的にバケットも削除される
    // CloudTrailのログは既に暗号化されているため、バケット自体はSSE-S3暗号化とする
    const logBucket = new Bucket(this, 'Bucket', {
      bucketName: `${PjPrefix.toLowerCase()}-shared-log-${cdk.Stack.of(this).account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      LifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(1825), //5年
        },
      ],
    });

    // リソースポリシーの追加
    logBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [logBucket.bucket.arnForObjects('*')],
      }),
    );

    logBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSBucketPermissions',
        effect: iam.Effect.ALLOW,
        resources: [logBucket.bucket.bucketArn],
        principals: [
          new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
          new iam.ServicePrincipal('config.amazonaws.com'),
        ],
        actions: ['s3:GetBucketAcl', 's3:ListBucket'],
      }),
    );

    logBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSBucketDelivery',
        effect: iam.Effect.ALLOW,
        resources: [`${logBucket.bucket.bucketArn}/*/*`],
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
      }),
    );

    //CFn output
    new cdk.CfnOutput(this, 'Shared Log Bucket', {
      value: logBucket.bucket.bucketName,
      description: 'Bucket for CloudTrail log',
    });
  }
}
