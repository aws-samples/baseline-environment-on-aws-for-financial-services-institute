import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_cloudtrail as trail } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';

/*
 * ゲストアカウントでのCloudTrail証跡の作成
 * 説明：
 * Control Tower LandingZone 3.0 からCloudTrailは組織の証跡が有効化され、CloudWatch LogsGroupはAuditアカウント側に
 * 作成されるようになったが、ゲストアカウント側でのアラート通知を有効化させるために別途CloudTrail証跡をゲストアカウント側に作成する
 */

export class TrailStack extends cdk.Stack {
  public readonly cloudTrailLogGroup: cwl.LogGroup;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Archive Bucket for CloudTrail
    const archiveLogsBucket = new s3.Bucket(this, 'ArchiveLogsBucket', {
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
    //protection from deleting objects
    archiveLogsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [archiveLogsBucket.arnForObjects('*')],
      }),
    );

    // Bucket for CloudTrail
    const cloudTrailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      serverAccessLogsBucket: archiveLogsBucket,
      serverAccessLogsPrefix: 'cloudtraillogs',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });
    //protection from deleting objects
    cloudTrailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [cloudTrailBucket.arnForObjects('*')],
      }),
    );

    // CMK for CloudTrail
    const cloudTrailKey = new kms.Key(this, 'CloudTrailKey', {
      enableKeyRotation: true,
      description: 'for CloudTrail',
      alias: 'for-cloudtrail',
    });
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
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${props?.env?.region}:${
              cdk.Stack.of(this).account
            }:log-group:*`,
          },
        },
      }),
    );

    // CloudWatch Logs Group for CloudTrail
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'CloudTrailLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: cloudTrailKey,
    });
    this.cloudTrailLogGroup = cloudTrailLogGroup;

    // CloudTrail Trail
    new trail.Trail(this, 'CloudTrail', {
      bucket: cloudTrailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      encryptionKey: cloudTrailKey,
      sendToCloudWatchLogs: true,
    });
  }
}
