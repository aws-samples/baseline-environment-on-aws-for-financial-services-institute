import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PjPrefix } from '../bin/parameter';
import { Environment } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_cloudtrail as trail } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Bucket } from './constructs/bleafsi-s3-bucket';
import { KmsKey } from './constructs/bleafsi-kms-key';

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
    // 必要に応じて removalPolicyは変更する。DESTROYはスタック削除時に自動的にバケットも削除される
    const bucketForTrail = new Bucket(this, 'Bucket', {
      bucketName: `${PjPrefix.toLowerCase()}-trail-log-${cdk.Stack.of(this).account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      accessLogsPrefix: 'cloudtraillogs',
      LifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(180), //半年
        },
      ],
    });

    //2 CloudTrail 証跡用 KMS CMK 作成
    const kmsCmk = createKmsCmk(this);

    //3 CloudTrail 証跡用 CloudWatch ロググループ作成
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'LogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: kmsCmk.key,
    });
    this.cloudTrailLogGroup = cloudTrailLogGroup;

    //4 CloudTrail 証跡作成
    new trail.Trail(this, 'Default', {
      bucket: bucketForTrail.bucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      encryptionKey: kmsCmk.key,
      sendToCloudWatchLogs: true,
    });
  }
}

/////////// private /////////////////
/*
 * CloudTrail証跡用 KMS CMK 作成
 */
function createKmsCmk(scope: Construct): KmsKey {
  // CMK for CloudTrail
  const cloudTrailKey = new KmsKey(scope, 'Kms', {
    description: 'BLEAFSI GovernanceBase: Used for CloudTrail Logs Encryption',
  });

  cloudTrailKey.addToResourcePolicy(
    new iam.PolicyStatement({
      actions: ['kms:GenerateDataKey*'],
      principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
      resources: ['*'],
      conditions: {
        StringLike: {
          'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(scope).account}:trail/*`],
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
        StringEquals: { 'kms:CallerAccount': `${cdk.Stack.of(scope).account}` },
        StringLike: {
          'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(scope).account}:trail/*`],
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
          'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${cdk.Stack.of(scope).region}:${
            cdk.Stack.of(scope).account
          }:log-group:*`,
        },
      },
    }),
  );

  return cloudTrailKey;
}
