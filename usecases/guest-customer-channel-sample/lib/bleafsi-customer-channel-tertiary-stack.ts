import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as nag_suppressions from './nag-suppressions';
import { PrivateBucket } from './s3-private-bucket';

export class CustomerChannelTertiaryStack extends Stack {
  public readonly parameterPath: string;
  public readonly backupBucketArnParameterName: string;
  public readonly backupKeyArnParameterName: string;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const backupKey = new kms.Key(this, 'BackupKey', {
      enableKeyRotation: true,
    });

    const backupAccessLogsBucket = new PrivateBucket(this, 'BackupAccessLogsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    const backupBucket = new PrivateBucket(this, 'BackupBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: backupKey,
      serverAccessLogsBucket: backupAccessLogsBucket,
      serverAccessLogsPrefix: 'access-logs/tertiary/',
    });

    this.parameterPath = `/CustomerChannelTertiaryStack/${id}`;

    this.backupBucketArnParameterName = `${this.parameterPath}/backupBucketArn`;
    new ssm.StringParameter(this, 'BackupBucketArnParameter', {
      parameterName: this.backupBucketArnParameterName,
      stringValue: backupBucket.bucketArn,
    });
    this.backupKeyArnParameterName = `${this.parameterPath}/backupKeyArn`;
    new ssm.StringParameter(this, 'BackupKeyArnParameter', {
      parameterName: this.backupKeyArnParameterName,
      stringValue: backupKey.keyArn,
    });

    nag_suppressions.addNagSuppressionsToLogRetention(this);
  }
}
