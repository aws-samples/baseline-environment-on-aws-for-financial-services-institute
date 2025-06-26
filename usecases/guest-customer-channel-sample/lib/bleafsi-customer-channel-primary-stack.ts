import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Queue } from './connect-l2';
import { CustomerChannelTertiaryStack } from './bleafsi-customer-channel-tertiary-stack';
import { CustomerChannelConnectInstance } from './connect-instance';
import { CustomerChannelInboundSample } from './inbound-sample';
import { CustomerChannelOutboundSample } from './outbound-sample';
import { ConnectInstanceConfig, QconnectConfig, CustomerProfilesConfig, CasesConfig } from './config';
import { PrivateBucket } from './s3-private-bucket';
import { BucketReplication } from './s3-replication';
import * as nag_suppressions from './nag-suppressions';
import { CloudFrontWafStack } from './call-monitoring/waf-stack';
import { CallMonitoring } from './call-monitoring/call-monitoring';
import { ImmediateInboundSample } from './immediate-inbound-sample';
import { WebCallSample } from './web-call-sample';
import { QconnectSample } from './samples/qconnect-sample';
import { CustomerProfilesSample } from './samples/customer-profiles-sample';
import { CasesSample } from './samples/cases-sample';

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

    const basicQueue = Queue.fromQueueName(this, 'BasicQueue', connectInstance.instance.instanceId, 'BasicQueue');
    new CustomerChannelInboundSample(this, 'InboundSample', { connectInstance, queue: basicQueue });

    new CustomerChannelOutboundSample(this, 'OutboundSample', { connectInstance });

    if (props.wafStack) {
      const callMonitoring = new CallMonitoring(this, 'CallMonitoring', {
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
