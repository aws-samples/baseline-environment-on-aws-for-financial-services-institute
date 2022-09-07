import { Construct } from 'constructs';
import { custom_resources, Stack, CustomResource, Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as nag_suppressions from '../bleafsi-nag-suppressions';
import { Instance } from './instance';

export interface EncryptionConfig {
  readonly encryptionType: string;
  readonly keyId: string;
}

export interface KinesisFirehoseConfig {
  readonly firehoseArn: string;
}
export interface KinesisStreamConfig {
  readonly streamArn: string;
}
export interface KinesisVideoStreamConfig {
  readonly prefix: string;
  readonly retentionPeriodHours: string;
  readonly encryptionConfig: EncryptionConfig;
}
export interface S3Config {
  readonly bucketName: string;
  readonly bucketPrefix: string;
  readonly encryptionConfig?: EncryptionConfig;
}
export interface StorageConfig {
  readonly associationId?: string;
  readonly kinesisFirehoseConfig?: KinesisFirehoseConfig;
  readonly kinesisStreamConfig?: KinesisStreamConfig;
  readonly kinesisVideoStreamConfig?: KinesisVideoStreamConfig;
  readonly s3config?: S3Config;
  readonly storageType: string;
}
export interface InstanceStorageConfigProps {
  readonly instance: Instance;
  readonly resourceType: string;
  readonly storageConfig: StorageConfig;
}

export class InstanceStorageConfig extends Construct {
  constructor(scope: Construct, id: string, props: InstanceStorageConfigProps) {
    super(scope, id);

    const provider = InstanceStorageConfigProvider.getInstance(this);
    new CustomResource(this, 'InstanceStorageConfig', {
      serviceToken: provider.serviceToken,
      properties: {
        Parameters: {
          InstanceId: props.instance.instanceId,
          ResourceType: props.resourceType,
          StorageConfig: {
            StorageType: props.storageConfig.storageType,
            AssociationId: props.storageConfig.associationId,
            KinesisFirehoseConfig: props.storageConfig.kinesisFirehoseConfig
              ? {
                  FirehoseArn: props.storageConfig.kinesisFirehoseConfig.firehoseArn,
                }
              : undefined,
            KinesisStreamConfig: props.storageConfig.kinesisStreamConfig
              ? {
                  StreamArn: props.storageConfig.kinesisStreamConfig.streamArn,
                }
              : undefined,
            KinesisVideoStreamConfig: props.storageConfig.kinesisVideoStreamConfig
              ? {
                  Prefix: props.storageConfig.kinesisVideoStreamConfig.prefix,
                  RetentionPeriodHours: props.storageConfig.kinesisVideoStreamConfig.retentionPeriodHours,
                  EncryptionConfig: {
                    EncryptionType: props.storageConfig.kinesisVideoStreamConfig.encryptionConfig.encryptionType,
                    KeyId: props.storageConfig.kinesisVideoStreamConfig.encryptionConfig.keyId,
                  },
                }
              : undefined,
            S3Config: props.storageConfig.s3config
              ? {
                  BucketName: props.storageConfig.s3config.bucketName,
                  BucketPrefix: props.storageConfig.s3config.bucketPrefix,
                  EncryptionConfig: props.storageConfig.s3config.encryptionConfig
                    ? {
                        EncryptionType: props.storageConfig.s3config.encryptionConfig.encryptionType,
                        KeyId: props.storageConfig.s3config.encryptionConfig.keyId,
                      }
                    : undefined,
                }
              : undefined,
          },
        },
      },
    });
    provider.addPolicyForInstance(props.instance);
    if (props.storageConfig.s3config) {
      const bucket = s3.Bucket.fromBucketName(this, 'InstanceStorageBucket', props.storageConfig.s3config.bucketName);
      provider.addPolicyForBucket(bucket.bucketArn);
      if (props.storageConfig.s3config.encryptionConfig) {
        // Note: "keyId" represents the Key ARN, not the Key ID.
        const keyArn = props.storageConfig.s3config.encryptionConfig.keyId;
        provider.addPolicyForKey(keyArn);
      }
    }
    if (props.storageConfig.kinesisFirehoseConfig) {
      provider.addPolicyForKinesisFirehose(props.storageConfig.kinesisFirehoseConfig.firehoseArn);
    }
  }
}

class InstanceStorageConfigProvider extends Construct {
  public readonly serviceToken: string;
  private readonly onEventHandler: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'instance-storage-config.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_16_X,
      timeout: Duration.seconds(15),
      description:
        'Provider handler for Connect.associateInstanceStorageConfig() & disassociateInstanceStorageConfig()',
    });
    this.onEventHandler = onEventHandler;
    nag_suppressions.addNagSuppressionsToLambda(onEventHandler);

    const provider = new custom_resources.Provider(this, 'Provider', {
      onEventHandler,
    });
    this.serviceToken = provider.serviceToken;
    nag_suppressions.addNagSuppressionsToProvider(provider);
  }

  public addPolicyForInstance(instance: Instance) {
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'connect:AssociateInstanceStorageConfig',
          'connect:UpdateInstanceStorageConfig',
          'connect:DisassociateInstanceStorageConfig',
        ],
        resources: [instance.instanceArn],
      }),
    );
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PutRolePolicy'],
        resources: [instance.serviceRole.roleArn],
      }),
    );
  }
  public addPolicyForBucket(bucketArn: string) {
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetBucketLocation', 's3:GetBucketAcl'],
        resources: [bucketArn],
      }),
    );
  }
  public addPolicyForKey(keyArn: string) {
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kms:CreateGrant', 'kms:DescribeKey', 'kms:ListAliases', 'kms:RetireGrant'],
        resources: [keyArn],
      }),
    );
  }
  public addPolicyForKinesisFirehose(firehoseArn: string) {
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['firehose:DescribeDeliveryStream', 'firehose:PutRecord', 'firehose:PutRecordBatch'],
        resources: [firehoseArn],
      }),
    );
  }

  public static getInstance(scope: Construct): InstanceStorageConfigProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'InstanceStorageConfigProvider';
    return (
      (stack.node.tryFindChild(uniqueId) as InstanceStorageConfigProvider) ??
      new InstanceStorageConfigProvider(stack, uniqueId)
    );
  }
}
