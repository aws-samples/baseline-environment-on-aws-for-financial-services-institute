import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { IInstance } from './instance';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { L1InstanceStorageConfig } from './l1-instance-storage-config';

export enum ResourceType {
  CHAT_TRANSCRIPTS = 'CHAT_TRANSCRIPTS',
  CALL_RECORDINGS = 'CALL_RECORDINGS',
  SCHEDULED_REPORTS = 'SCHEDULED_REPORTS',
  MEDIA_STREAMS = 'MEDIA_STREAMS',
  CONTACT_TRACE_RECORDS = 'CONTACT_TRACE_RECORDS',
  AGENT_EVENTS = 'AGENT_EVENTS',
  REAL_TIME_CONTACT_ANALYSIS_SEGMENTS = 'REAL_TIME_CONTACT_ANALYSIS_SEGMENTS',
  ATTACHMENTS = 'ATTACHMENTS',
  CONTACT_EVALUATIONS = 'CONTACT_EVALUATIONS',
  SCREEN_RECORDINGS = 'SCREEN_RECORDINGS',
  REAL_TIME_CONTACT_ANALYSIS_CHAT_SEGMENTS = 'REAL_TIME_CONTACT_ANALYSIS_CHAT_SEGMENTS',
  REAL_TIME_CONTACT_ANALYSIS_VOICE_SEGMENTS = 'REAL_TIME_CONTACT_ANALYSIS_VOICE_SEGMENTS',
  EMAIL_MESSAGES = 'EMAIL_MESSAGES',
}

export enum StorageType {
  KINESIS_FIREHOSE = 'KINESIS_FIREHOSE',
  KINESIS_STREAM = 'KINESIS_STREAM',
  KINESIS_VIDEO_STREAM = 'KINESIS_VIDEO_STREAM',
  S3 = 'S3',
}

export interface InstanceStorageConfigProps {
  readonly instance: IInstance;
  readonly resourceType: ResourceType;
  readonly storageType: StorageType;

  readonly kinesisFirehoseConfig?: connect.CfnInstanceStorageConfig.KinesisFirehoseConfigProperty;
  readonly kinesisStreamConfig?: connect.CfnInstanceStorageConfig.KinesisStreamConfigProperty;
  readonly kinesisVideoStreamConfig?: connect.CfnInstanceStorageConfig.KinesisVideoStreamConfigProperty;
  readonly s3Config?: connect.CfnInstanceStorageConfig.S3ConfigProperty;
}

export interface IInstanceStorageConfig extends IResource {
  readonly instance: IInstance;
  readonly associationId: string;
}

export class InstanceStorageConfig extends Resource implements IInstanceStorageConfig {
  private readonly l1InstanceStorageConfig: L1InstanceStorageConfig;
  public readonly instance: IInstance;
  public readonly associationId: string;

  constructor(scope: Construct, id: string, props: InstanceStorageConfigProps) {
    super(scope, id);

    this.l1InstanceStorageConfig = new L1InstanceStorageConfig(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      resourceType: props.resourceType,
      storageType: props.storageType,
      kinesisFirehoseConfig: props.kinesisFirehoseConfig,
      kinesisStreamConfig: props.kinesisStreamConfig,
      kinesisVideoStreamConfig: props.kinesisVideoStreamConfig,
      s3Config: props.s3Config,
    });

    this.instance = props.instance;
    this.associationId = this.l1InstanceStorageConfig.attrAssociationId;
  }
}

export interface KinesisFirehoseStorageConfigProps {
  readonly instance: IInstance;
  readonly resourceType: ResourceType;
  readonly deliveryStream: kinesisfirehose.CfnDeliveryStream;
}

export class KinesisFirehoseStorageConfig extends InstanceStorageConfig {
  constructor(scope: Construct, id: string, props: KinesisFirehoseStorageConfigProps) {
    super(scope, id, {
      instance: props.instance,
      resourceType: props.resourceType,
      storageType: StorageType.KINESIS_FIREHOSE,
      kinesisFirehoseConfig: {
        firehoseArn: props.deliveryStream.attrArn,
      },
    });

    this.node.addDependency(props.instance);
    this.node.addDependency(props.deliveryStream);
  }
}

export interface KinesisStreamStorageConfigProps {
  readonly instance: IInstance;
  readonly resourceType: ResourceType;
  readonly stream: kinesis.IStream;
}

export class KinesisStorageConfig extends InstanceStorageConfig {
  constructor(scope: Construct, id: string, props: KinesisStreamStorageConfigProps) {
    super(scope, id, {
      instance: props.instance,
      resourceType: props.resourceType,
      storageType: StorageType.KINESIS_STREAM,
      kinesisStreamConfig: {
        streamArn: props.stream.streamArn,
      },
    });

    this.node.addDependency(props.instance);
    this.node.addDependency(props.stream);
  }
}

export interface S3StorageConfigProps {
  readonly instance: IInstance;
  readonly resourceType: ResourceType;
  readonly bucket: s3.IBucket;
  readonly bucketPrefix: string;
  readonly key?: kms.IKey;
}

export class S3StorageConfig extends InstanceStorageConfig {
  constructor(scope: Construct, id: string, props: S3StorageConfigProps) {
    super(scope, id, {
      instance: props.instance,
      resourceType: props.resourceType,
      storageType: StorageType.S3,
      s3Config: {
        bucketName: props.bucket.bucketName,
        bucketPrefix: props.bucketPrefix,
        encryptionConfig: props.key
          ? {
              encryptionType: 'KMS',
              keyId: props.key.keyArn, // provide the full ARN, not the ID
            }
          : undefined,
      },
    });

    this.node.addDependency(props.instance);
    this.node.addDependency(props.bucket);
    if (props.key) {
      this.node.addDependency(props.key);
    }
  }
}
