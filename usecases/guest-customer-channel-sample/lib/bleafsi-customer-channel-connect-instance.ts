import { Stack, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as cr_connect from './bleafsi-cr-connect';
import { ContactFlowConfig, SamlProviderConfig, ConnectInstanceConfig } from './bleafsi-customer-channel-config';
import * as fs from 'fs';
import * as path from 'path';
import { NagSuppressions } from 'cdk-nag';

interface CustomerChannelConnectInstanceProps {
  readonly connectInstance: ConnectInstanceConfig;
  readonly recordingBucket: s3.IBucket;
  readonly recordingKey: kms.IKey;
  readonly recordingPrefix: string;
  readonly localRecordingKey: kms.IKey;
}
export class CustomerChannelConnectInstance extends Construct {
  public readonly instance: cr_connect.Instance;

  constructor(scope: Construct, id: string, props: CustomerChannelConnectInstanceProps) {
    super(scope, id);

    const instance = this.createInstance(props.connectInstance);
    this.instance = instance;
    if (props.connectInstance.samlProvider) {
      this.createSamlIntegration(props.connectInstance.samlProvider, instance);
    }

    this.addS3RecordingConfigs(instance, props.recordingBucket, props.recordingKey, props.recordingPrefix);
    this.addCtrRecordingConfig(
      instance,
      props.recordingBucket,
      props.recordingKey,
      props.recordingPrefix,
      props.localRecordingKey,
    );

    this.createContactFlows(instance, props.connectInstance.contactFlows ?? []);
  }

  private createInstance(config: ConnectInstanceConfig): cr_connect.Instance {
    return new cr_connect.Instance(this, 'Instance', {
      instanceAlias: config.instanceAlias,
      inboundCallsEnabled: config.inboundCallsEnabled ?? true,
      outboundCallsEnabled: config.outboundCallsEnabled ?? true,
      identityManagementType: config.identityManagementType ?? 'CONNECT_MANAGED',
      directoryId: config.directoryId,
    });
  }

  private createSamlIntegration(samlConf: SamlProviderConfig, instance: cr_connect.Instance) {
    const provider = new iam.SamlProvider(this, 'SamlProvider', {
      metadataDocument: iam.SamlMetadataDocument.fromFile(samlConf.metadataDocumentPath),
      name: samlConf.name,
    });
    const role = new iam.Role(this, 'SamlRole', {
      assumedBy: new iam.SamlConsolePrincipal(provider),
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['connect:GetFederationToken'],
        resources: [instance.instanceArn + '/user/${aws:userid}'],
      }),
    );

    new CfnOutput(this, 'SamlRoleArn', {
      value: role.roleArn,
    });
    new CfnOutput(this, 'SamlProviderArn', {
      value: provider.samlProviderArn,
    });
    const stack = Stack.of(this);
    new CfnOutput(this, 'SamlRelayState', {
      value: `https://${stack.region}.console.aws.amazon.com/connect/federate/${instance.instanceId}`,
    });
  }

  private addS3RecordingConfigs(
    instance: cr_connect.Instance,
    recordingBucket: s3.IBucket,
    recordingKey: kms.IKey,
    recordingPrefix: string,
  ) {
    new cr_connect.S3StorageConfig(this, 'CallRecordingConfig', {
      instance,
      resourceType: 'CALL_RECORDINGS',
      bucket: recordingBucket,
      bucketPrefix: `${recordingPrefix}/call-recordings`,
      key: recordingKey,
    });
    new cr_connect.S3StorageConfig(this, 'ChatTranscriptConfig', {
      instance,
      resourceType: 'CHAT_TRANSCRIPTS',
      bucket: recordingBucket,
      bucketPrefix: `${recordingPrefix}/chat-transcripts`,
      key: recordingKey,
    });
    new cr_connect.S3StorageConfig(this, 'ScheduledReportsConfig', {
      instance,
      resourceType: 'SCHEDULED_REPORTS',
      bucket: recordingBucket,
      bucketPrefix: `${recordingPrefix}/scheduled-reports`,
      key: recordingKey,
    });
  }

  private addCtrRecordingConfig(
    instance: cr_connect.Instance,
    recordingBucket: s3.IBucket,
    recordingKey: kms.IKey,
    recordingPrefix: string,
    localRecordingKey: kms.IKey,
  ) {
    const region = Stack.of(this).region;
    const objectsPrefix = `${recordingPrefix}/contact-trace-records/`;
    const objectsArn = recordingBucket.arnForObjects(`${objectsPrefix}*`);

    const deliveryStreamRole = new iam.Role(this, 'CtrDeliveryStreamRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });
    deliveryStreamRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetBucketLocation', 's3:ListBucket', 's3:ListBucketMultipartUploads'],
        resources: [recordingBucket.bucketArn],
      }),
    );
    deliveryStreamRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:AbortMultipartUpload', 's3:GetObject', 's3:PutObject'],
        resources: [objectsArn],
      }),
    );
    deliveryStreamRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [recordingKey.keyArn],
        conditions: {
          StringEquals: {
            'kms:ViaService': `s3.${region}.amazonaws.com`,
            'kms:EncryptionContext:aws:s3:arn': recordingBucket.bucketArn,
          },
        },
      }),
    );
    NagSuppressions.addResourceSuppressions(
      deliveryStreamRole,
      [{ id: 'AwsSolutions-IAM5', reason: 'Role for delivery stream requires wildcard to save contact trace records' }],
      true,
    );

    const deliveryStream = new kinesisfirehose.CfnDeliveryStream(this, 'CtrDeliveryStream', {
      deliveryStreamName: 'CtrDeliveryStream',
      deliveryStreamType: 'DirectPut',
      deliveryStreamEncryptionConfigurationInput: {
        keyType: 'CUSTOMER_MANAGED_CMK',
        keyArn: localRecordingKey.keyArn,
      },
      s3DestinationConfiguration: {
        bucketArn: recordingBucket.bucketArn,
        prefix: objectsPrefix,
        roleArn: deliveryStreamRole.roleArn,
        encryptionConfiguration: {
          kmsEncryptionConfig: {
            awskmsKeyArn: recordingKey.keyArn,
          },
        },
      },
    });
    deliveryStream.node.addDependency(deliveryStreamRole);

    new cr_connect.KinesisFirehoseStorageConfig(this, 'CtrDeliveryStreamConfig', {
      instance,
      resourceType: 'CONTACT_TRACE_RECORDS',
      deliveryStream,
    });
  }

  private createContactFlows(
    instance: cr_connect.Instance,
    contactFlowConfigList: ContactFlowConfig[],
  ): connect.CfnContactFlow[] {
    return contactFlowConfigList.map((contactFlowConfig) => {
      const name = contactFlowConfig.name;
      const type = contactFlowConfig.type;
      const contactFlowPath = path.join(__dirname, '..', 'asset', `${name}.json`);
      const contactFlowContent = fs.readFileSync(contactFlowPath, 'utf-8');
      const contactFlow = new connect.CfnContactFlow(this, `ContactFlow-${name}`, {
        instanceArn: instance.instanceArn,
        type: type,
        content: contactFlowContent,
        name: name,
      });
      contactFlow.node.addDependency(instance);
      return contactFlow;
    });
  }
}
