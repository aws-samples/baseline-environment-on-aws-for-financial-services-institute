import { Stack, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as connect_l2 from '../../constructs-l2/connect';
import { SamlProviderConfig, ConnectInstanceConfig, UserConfig } from '../../config';
import { NagSuppressions } from 'cdk-nag';
import { adminPermissions } from './security-profile-permissions';

interface CustomerChannelQconnectConfiguration {
  readonly key: kms.IKey;
}

interface CustomerChannelConnectInstanceProps {
  readonly connectInstance: ConnectInstanceConfig;
  readonly recordingBucket: s3.IBucket;
  readonly recordingKey: kms.IKey;
  readonly recordingPrefix: string;
  readonly localRecordingKey: kms.IKey;
  readonly qconnect?: CustomerChannelQconnectConfiguration;
}

export class CustomerChannelConnectInstance extends Construct {
  public readonly instance: connect_l2.Instance;

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

    if (props.connectInstance.adminUsers) {
      this.createAdminUsers(instance, props.connectInstance.adminUsers);
    }
  }

  private createInstance(config: ConnectInstanceConfig): connect_l2.Instance {
    return new connect_l2.Instance(this, 'Instance', {
      instanceAlias: config.instanceAlias,
      attributes: {
        inboundCalls: config.attributes?.inboundCalls ?? true,
        outboundCalls: config.attributes?.outboundCalls ?? true,
        autoResolveBestVoices: config.attributes?.autoResolveBestVoices ?? true,
        contactflowLogs: config.attributes?.contactflowLogs ?? true,
        contactLens: config.attributes?.contactLens ?? true,
        earlyMedia: config.attributes?.earlyMedia ?? true,
        useCustomTtsVoices: config.attributes?.useCustomTtsVoices ?? false,
      },
      identityManagementType: config.identityManagementType ?? connect_l2.IdentityManagementType.CONNECT_MANAGED,
      directoryId: config.directoryId,
    });
  }

  private createSamlIntegration(samlConf: SamlProviderConfig, instance: connect_l2.Instance) {
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
    instance: connect_l2.Instance,
    recordingBucket: s3.IBucket,
    recordingKey: kms.IKey,
    recordingPrefix: string,
  ) {
    new connect_l2.S3StorageConfig(this, 'CallRecordingConfig', {
      instance,
      resourceType: connect_l2.ResourceType.CALL_RECORDINGS,
      bucket: recordingBucket,
      bucketPrefix: `${recordingPrefix}/call-recordings`,
      key: recordingKey,
    });
    new connect_l2.S3StorageConfig(this, 'ChatTranscriptConfig', {
      instance,
      resourceType: connect_l2.ResourceType.CHAT_TRANSCRIPTS,
      bucket: recordingBucket,
      bucketPrefix: `${recordingPrefix}/chat-transcripts`,
      key: recordingKey,
    });
    new connect_l2.S3StorageConfig(this, 'ScheduledReportsConfig', {
      instance,
      resourceType: connect_l2.ResourceType.SCHEDULED_REPORTS,
      bucket: recordingBucket,
      bucketPrefix: `${recordingPrefix}/scheduled-reports`,
      key: recordingKey,
    });
  }

  private addCtrRecordingConfig(
    instance: connect_l2.Instance,
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

    new connect_l2.KinesisFirehoseStorageConfig(this, 'CtrDeliveryStreamConfig', {
      instance,
      resourceType: connect_l2.ResourceType.CONTACT_TRACE_RECORDS,
      deliveryStream,
    });
  }

  private createAdminUsers(instance: connect_l2.IInstance, users: UserConfig[]) {
    const adminSecurityProfile = new connect_l2.SecurityProfile(this, 'CustomerChannelAdminSecurityProfile', {
      instance,
      securityProfileName: 'CustomerChannelAdmin',
      permissions: adminPermissions,
    });

    const basicQueue = connect_l2.Queue.fromQueueName(this, 'BasicQueue', instance.instanceId, 'BasicQueue');

    const routingProfile = new connect_l2.RoutingProfile(this, 'CustomerChannelRoutingProfile', {
      instance,
      description: 'CustomerChannelRoutingProfile',
      routingProfileName: 'CustomerChannelRoutingProfile',
      mediaConcurrencies: [
        {
          channel: connect_l2.ChannelType.VOICE,
          concurrency: 1,
        },
        {
          channel: connect_l2.ChannelType.CHAT,
          concurrency: 2,
        },
        {
          channel: connect_l2.ChannelType.TASK,
          concurrency: 1,
        },
        {
          channel: connect_l2.ChannelType.EMAIL,
          concurrency: 1,
        },
      ],
      queueConfigs: [
        {
          queue: basicQueue,
          channel: connect_l2.ChannelType.VOICE,
          priority: 1,
          delay: 0,
        },
        {
          queue: basicQueue,
          channel: connect_l2.ChannelType.CHAT,
          priority: 1,
          delay: 0,
        },
        {
          queue: basicQueue,
          channel: connect_l2.ChannelType.TASK,
          priority: 1,
          delay: 0,
        },
        {
          queue: basicQueue,
          channel: connect_l2.ChannelType.EMAIL,
          priority: 1,
          delay: 0,
        },
      ],
      defaultOutboundQueue: basicQueue,
    });

    this.createUsers(instance, [adminSecurityProfile], routingProfile, users);
  }

  private createUsers(
    instance: connect_l2.IInstance,
    securityProfiles: connect_l2.ISecurityProfile[],
    routingProfile: connect_l2.IRoutingProfile,
    users: UserConfig[],
  ) {
    users.forEach((user) => {
      new connect_l2.User(this, `User-${user.alias}`, {
        instance,
        username: user.alias,
        password: user.password,
        identityInfo: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        phoneConfig: {
          phoneType: connect_l2.PhoneType.SOFT_PHONE,
        },
        routingProfile,
        securityProfiles,
      });
    });
  }
}
