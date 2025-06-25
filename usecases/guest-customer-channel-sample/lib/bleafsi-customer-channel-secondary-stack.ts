import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { CustomerChannelTertiaryStack } from './bleafsi-customer-channel-tertiary-stack';
import { CustomerChannelConnectInstance } from './connect-instance';
import { ConnectInstanceConfig } from './config';
import * as nag_suppressions from './nag-suppressions';

export interface CustomerChannelSecondaryStackProps extends StackProps {
  readonly connectInstance: ConnectInstanceConfig;
  readonly tertiaryStack: CustomerChannelTertiaryStack;
}

export class CustomerChannelSecondaryStack extends Stack {
  constructor(scope: Construct, id: string, props: CustomerChannelSecondaryStackProps) {
    super(scope, id, props);

    const localRecordingKey = new kms.Key(this, 'LocalRecordingKey', {
      enableKeyRotation: true,
    });

    new CustomerChannelConnectInstance(this, 'ConnectInstance', {
      connectInstance: props.connectInstance,
      recordingBucket: props.tertiaryStack.backupBucket,
      recordingKey: props.tertiaryStack.backupKey,
      recordingPrefix: 'secondary',
      localRecordingKey,
    });

    nag_suppressions.addNagSuppressionsToLogRetention(this);
  }
}
