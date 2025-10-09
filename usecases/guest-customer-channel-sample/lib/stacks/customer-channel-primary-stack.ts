import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Queue } from '../constructs-l2/connect';
import { CustomerChannelTertiaryStack } from './customer-channel-tertiary-stack';
import { CustomerChannelConnectInstance } from '../samples/connect-instance';
import { CustomerChannelInboundSample } from '../samples/inbound-sample';
import { CustomerChannelOutboundSample } from '../samples/outbound-sample';
import { ConnectInstanceConfig, QconnectConfig, CustomerProfilesConfig, CasesConfig } from '../config';
import { PrivateBucket } from '../constructs/s3-private-bucket';
import { BucketReplication } from '../constructs/s3-replication';
import * as nag_suppressions from '../nag-suppressions';
import { CloudFrontWafStack } from '../samples/call-monitoring-sample/waf-stack';
import { CallMonitoringSample } from '../samples/call-monitoring-sample';
import { ImmediateInboundSample } from '../samples/immediate-inbound-sample';
import { WebCallSample } from '../samples/web-call-sample';
import { QconnectSample } from '../samples/qconnect-sample';
import { CustomerProfilesSample } from '../samples/customer-profiles-sample';
import { CasesSample } from '../samples/cases-sample';

// 顧客チャネルサンプルアプリケーション Primary Region 用スタック

export interface CustomerChannelPrimaryStackProps extends StackProps {
  readonly connectInstance: ConnectInstanceConfig;
  readonly tertiaryStack?: CustomerChannelTertiaryStack;
  readonly wafStack?: CloudFrontWafStack;
  readonly connectWidgetId?: string;
  readonly connectSnippetId?: string;
  readonly qconnectConfig?: QconnectConfig;
  readonly customerProfilesConfig?: CustomerProfilesConfig;
  readonly casesConfig?: CasesConfig;
}

export class CustomerChannelPrimaryStack extends Stack {
  constructor(scope: Construct, id: string, props: CustomerChannelPrimaryStackProps) {
    super(scope, id, props);

    const recordingKey = new kms.Key(this, 'RecordingKey', {
      description: 'Customer channel recording key',
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

    new CustomerChannelOutboundSample(this, 'OutboundSample', { connectInstance });

    if (props.wafStack) {
      const callMonitoring = new CallMonitoringSample(this, 'CallMonitoring', {
        connectInstance: connectInstance.instance,
        connectUrl: `https://${props.connectInstance.instanceAlias}.awsapps.com`,
        webAclId: props.wafStack.webAclArn.value,
        users: props.connectInstance.adminUsers,
      });
      callMonitoring.node.addDependency(connectInstance);

      // Deploy the mock bank site
      new WebCallSample(this, 'WebCallSample', {
        webAclId: props.wafStack.webAclArn.value,
        connectInstance: connectInstance.instance,
        connectWidgetId: props.connectWidgetId,
        connectSnippetId: props.connectSnippetId,
      });

      nag_suppressions.addNagSuppressionsToNodejsBuild(this);
    }

    const qconnectConfigEnabled = props.qconnectConfig?.enabled ?? true;
    const qconnectSample = qconnectConfigEnabled
      ? new QconnectSample(this, 'QconnectSample', {
          instance: connectInstance.instance,
          key: recordingKey,
        })
      : undefined;

    const basicQueue = Queue.fromQueueName(this, 'BasicQueue', connectInstance.instance.instanceId, 'BasicQueue');
    new ImmediateInboundSample(this, 'ImmediateInboundSample', {
      connectInstance,
      queue: basicQueue,
      assistant: qconnectSample?.assistant,
    });

    const customerProfilesConfigEnabled = props.customerProfilesConfig?.enabled ?? true;
    if (customerProfilesConfigEnabled) {
      new CustomerProfilesSample(this, 'CustomerProfilesSample', {
        key: recordingKey,
        connectInstance: connectInstance.instance,
      });
    }

    const casesConfigEnabled = props.casesConfig?.enabled ?? true;
    if (casesConfigEnabled) {
      new CasesSample(this, 'CasesSample', {
        connectInstance: connectInstance.instance,
      });
    }

    nag_suppressions.addNagSuppressionsToLogRetention(this);
  }

  private createRecordingBackups(
    tertiaryStack: CustomerChannelTertiaryStack,
    recordingBucket: s3.Bucket,
    recordingKey: kms.Key,
  ) {
    const recordingReplication = new BucketReplication(this, 'RecordingReplication', {
      sourceBucket: recordingBucket,
      sourceKey: recordingKey,
    });
    recordingReplication.addReplicationRule({
      destinationBucket: tertiaryStack.backupBucket,
      destinationKey: tertiaryStack.backupKey,
    });
  }
}
