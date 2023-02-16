import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Environment } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_cloudtrail as trail } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';

/*
 * Control Tower ゲストアカウントでのCloudTrail証跡の作成
 *  Control Tower LandingZone 3.0 からCloudTrailは組織の証跡が有効化され、CloudWatch LogGroupはAuditアカウント側に
 *  作成されるようになったが、ゲストアカウント側でのアラート通知を有効化させるために別途CloudTrail証跡をゲストアカウント側に作成する
 */
export class CloudTrail extends Construct {
  public readonly cloudTrailLogGroup: cwl.LogGroup;

  constructor(scope: Construct, id: string, env?: Environment) {
    super(scope, id);

    //1 CloudTrail 証跡用バケット作成
    const bucketForTrail = new BucketForTrail(this, 'Bucket');

    //2 CloudTrail 証跡用 KMS CMK 作成
    const kmsCmk = new KmsCmk(this, 'Kms', env?.region as string);

    //3 CloudTrail 証跡用 CloudWatch ロググループ作成
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'LogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: kmsCmk.cloudTrailKey,
    });
    this.cloudTrailLogGroup = cloudTrailLogGroup;

    //4 CloudTrail 証跡作成
    new trail.Trail(this, 'Default', {
      bucket: bucketForTrail.bucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      encryptionKey: kmsCmk.cloudTrailKey,
      sendToCloudWatchLogs: true,
    });
  }
}

/////////// private Construct /////////////////
/*
 * CloudTrail証跡用 KMS CMK 作成
 */
class KmsCmk extends Construct {
  readonly cloudTrailKey: kms.Key;
  constructor(scope: Construct, id: string, region: string) {
    super(scope, id);

    // CMK for CloudTrail
    const cloudTrailKey = new kms.Key(this, 'Default', {
      enableKeyRotation: true,
      description: 'BLEAFSI GovernanceBase: Used for CloudTrail Logs Encryption',
      alias: 'CloudTrail-Logs',
    });
    this.cloudTrailKey = cloudTrailKey;

    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:GenerateDataKey*'],
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        resources: ['*'],
        conditions: {
          StringLike: {
            'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(this).account}:trail/*`],
          },
        },
      }),
    );
    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:DescribeKey'],
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        resources: ['*'],
      }),
    );
    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt', 'kms:ReEncryptFrom'],
        principals: [new iam.AnyPrincipal()],
        resources: ['*'],
        conditions: {
          StringEquals: { 'kms:CallerAccount': `${cdk.Stack.of(this).account}` },
          StringLike: {
            'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(this).account}:trail/*`],
          },
        },
      }),
    );
    cloudTrailKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal('logs.amazonaws.com')],
        resources: ['*'],
        conditions: {
          ArnEquals: {
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${region}:${cdk.Stack.of(this).account}:log-group:*`,
          },
        },
      }),
    );
  }
}

/*
 * CloudTrail 証跡用 S3バケット作成
 */
class BucketForTrail extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // 1 アクセスログ バケット作成
    const accessLogsBucket = new AccessLogsBucket(this, 'AccessLogs');

    // 2 CloudTrail 証跡用のバケット作成
    const cloudTrailBucket = new s3.Bucket(this, 'Default', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: accessLogsBucket.bucket,
      serverAccessLogsPrefix: 'cloudtraillogs',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });
    //オブジェクトの削除を禁止するポリシー追加
    cloudTrailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [cloudTrailBucket.arnForObjects('*')],
      }),
    );

    this.bucket = cloudTrailBucket;
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
