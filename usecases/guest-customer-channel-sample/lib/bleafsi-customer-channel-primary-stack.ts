import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cr_connect from './cr-connect';
import { CustomerChannelTertiaryStack } from './bleafsi-customer-channel-tertiary-stack';
import { CustomerChannelConnectInstance } from './connect-instance';
import { CustomerChannelInboundSample } from './inbound-sample';
import { CustomerChannelOutboundSample } from './outbound-sample';
import { ConnectInstanceConfig } from './config';
import { PrivateBucket } from './s3-private-bucket';
import { BucketReplication } from './s3-replication';
import { RemoteParameters } from 'cdk-remote-stack';
import * as nag_suppressions from './nag-suppressions';

// 顧客チャネルサンプルアプリケーション Primary Region 用スタック

export interface CustomerChannelPrimaryStackProps extends StackProps {
  readonly connectInstance: ConnectInstanceConfig;
  readonly tertiaryStack?: CustomerChannelTertiaryStack;
}

export class CustomerChannelPrimaryStack extends Stack {
  constructor(scope: Construct, id: string, props: CustomerChannelPrimaryStackProps) {
    super(scope, id, props);

    const recordingKey = new kms.Key(this, 'RecordingKey', {
      enableKeyRotation: true,
    });
    const accessLogsBucket = new PrivateBucket(this, 'AccessLogsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    const recordingBucket = new PrivateBucket(this, 'RecordingBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: recordingKey,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'access-logs/primary/',
    });

    const connectInstance = new CustomerChannelConnectInstance(this, 'ConnectInstance', {
      connectInstance: props.connectInstance,
      recordingBucket,
      recordingKey,
      recordingPrefix: 'primary',
      localRecordingKey: recordingKey,
    });

    if (props.tertiaryStack) {
      this.createRecordingBackups(props.tertiaryStack, recordingBucket, recordingKey);
      this.addDependency(props.tertiaryStack);
    }

    const basicQueue = cr_connect.Queue.fromQueueName(
      this,
      'BasicQueue',
      connectInstance.instance.instanceId,
      'BasicQueue',
    );
    new CustomerChannelInboundSample(this, 'InboundSample', { connectInstance, queue: basicQueue });

    new CustomerChannelOutboundSample(this, 'OutboundSample', { connectInstance });

    nag_suppressions.addNagSuppressionsToLogRetention(this);
  }

  private createRecordingBackups(
    tertiaryStack: CustomerChannelTertiaryStack,
    recordingBucket: s3.Bucket,
    recordingKey: kms.Key,
  ) {
    const tertiaryStackOutputs = new RemoteParameters(this, 'TertiaryStackOutputs', {
      path: tertiaryStack.parameterPath,
      region: tertiaryStack.region,
      alwaysUpdate: false, // Stop refreshing the resource for snapshot testing
    });
    nag_suppressions.addNagSuppressionsToRemoteParameters(tertiaryStackOutputs);

    const backupBucket = s3.Bucket.fromBucketArn(
      this,
      'BackupBucket',
      tertiaryStackOutputs.get(tertiaryStack.backupBucketArnParameterName),
    );
    const backupKey = kms.Key.fromKeyArn(
      this,
      'BackupKey',
      tertiaryStackOutputs.get(tertiaryStack.backupKeyArnParameterName),
    );

    const recordingReplication = new BucketReplication(this, 'RecordingReplication', {
      sourceBucket: recordingBucket,
      sourceKey: recordingKey,
    });
    recordingReplication.addReplicationRule({
      destinationBucket: backupBucket,
      destinationKey: backupKey,
    });
  }
}
