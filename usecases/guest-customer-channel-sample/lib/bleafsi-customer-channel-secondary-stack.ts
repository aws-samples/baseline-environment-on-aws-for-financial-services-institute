import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { CustomerChannelTertiaryStack } from './bleafsi-customer-channel-tertiary-stack';
import { CustomerChannelConnectInstance } from './connect-instance';
import { ConnectInstanceConfig } from './config';
import { RemoteParameters } from 'cdk-remote-stack';
import * as nag_suppressions from './nag-suppressions';

export interface CustomerChannelSecondaryStackProps extends StackProps {
  readonly connectInstance: ConnectInstanceConfig;
  readonly tertiaryStack: CustomerChannelTertiaryStack;
}

export class CustomerChannelSecondaryStack extends Stack {
  constructor(scope: Construct, id: string, props: CustomerChannelSecondaryStackProps) {
    super(scope, id, props);

    const tertiaryStack = props.tertiaryStack;
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

    const localRecordingKey = new kms.Key(this, 'LocalRecordingKey', {
      enableKeyRotation: true,
    });

    new CustomerChannelConnectInstance(this, 'ConnectInstance', {
      connectInstance: props.connectInstance,
      recordingBucket: backupBucket,
      recordingKey: backupKey,
      recordingPrefix: 'secondary',
      localRecordingKey,
    });
  }
}
