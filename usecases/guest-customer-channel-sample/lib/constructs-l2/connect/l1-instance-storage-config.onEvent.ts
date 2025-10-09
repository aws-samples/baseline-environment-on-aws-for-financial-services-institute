import {
  ConnectClient,
  AssociateInstanceStorageConfigCommand,
  AssociateInstanceStorageConfigRequest,
  UpdateInstanceStorageConfigCommand,
  DisassociateInstanceStorageConfigCommand,
  InstanceStorageResourceType,
} from '@aws-sdk/client-connect';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as connect from 'aws-cdk-lib/aws-connect';

const connectClient = new ConnectClient();

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType == 'Create') {
    return await associateInstanceStorageConfig(event);
  } else if (event.RequestType == 'Update') {
    return await updateInstanceStorageConfig(event);
  } else if (event.RequestType == 'Delete') {
    return await disassociateInstanceStorageConfig(event);
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function associateInstanceStorageConfig(event: OnEventRequest): Promise<OnEventResponse> {
  const cfnParams = event.ResourceProperties.Parameters as connect.CfnInstanceStorageConfigProps;
  const sdkParams = convertCfnParamsToSdkParams(cfnParams);
  const ret = await connectClient.send(new AssociateInstanceStorageConfigCommand(sdkParams));
  console.log(`connect.associateInstanceStorageConfig() => %o`, ret);

  return {
    PhysicalResourceId: ret.AssociationId,
    Data: {
      AssociationId: ret.AssociationId,
    },
  };
}
async function updateInstanceStorageConfig(event: OnEventRequest): Promise<OnEventResponse> {
  const associationId = event.PhysicalResourceId;
  if (!associationId) {
    throw Error('updateInstanceStorageConfig() requires event.PhysicalResourceId');
  }

  const cfnParams = event.ResourceProperties.Parameters as connect.CfnInstanceStorageConfigProps;
  const sdkParams = convertCfnParamsToSdkParams(cfnParams);

  const ret = await connectClient.send(
    new UpdateInstanceStorageConfigCommand({
      ...sdkParams,
      AssociationId: associationId,
    }),
  );
  console.log(`connect.updateInstanceStorageConfig() => %o`, ret);

  return {
    Data: {
      AssociationId: associationId,
    },
  };
}
async function disassociateInstanceStorageConfig(event: OnEventRequest): Promise<OnEventResponse> {
  const associationId = event.PhysicalResourceId;
  if (!associationId) {
    throw Error('disassociateInstanceStorageConfig() requires event.PhysicalResourceId');
  }

  const cfnParams = event.ResourceProperties.Parameters as connect.CfnInstanceStorageConfigProps;
  const sdkParams = convertCfnParamsToSdkParams(cfnParams);

  const ret = await connectClient.send(
    new DisassociateInstanceStorageConfigCommand({
      ...sdkParams,
      AssociationId: associationId,
    }),
  );
  console.log(`connect.disassociateInstanceStorageConfig() => %o`, ret);

  return {
    Data: {
      AssociationId: associationId,
    },
  };
}

function convertCfnParamsToSdkParams(
  props: connect.CfnInstanceStorageConfigProps,
): AssociateInstanceStorageConfigRequest {
  // Extract instance ID from ARN
  const instanceId = props.instanceArn.split('/').pop();
  if (!instanceId) {
    throw new Error('Failed to extract instance ID from ARN: ' + props.instanceArn);
  }

  const resourceType = props.resourceType as InstanceStorageResourceType;

  // Create the storage config based on which config is provided
  if (props.s3Config) {
    if (props.storageType !== 'S3') {
      throw new Error(`Storage type mismatch: expected S3, got ${props.storageType}`);
    }

    const s3Config = props.s3Config as connect.CfnInstanceStorageConfig.S3ConfigProperty;
    const encryptionConfig = s3Config.encryptionConfig as
      | connect.CfnInstanceStorageConfig.EncryptionConfigProperty
      | undefined;
    return {
      InstanceId: instanceId,
      ResourceType: resourceType,
      StorageConfig: {
        StorageType: 'S3',
        S3Config: {
          BucketName: s3Config.bucketName,
          BucketPrefix: s3Config.bucketPrefix,
          EncryptionConfig: encryptionConfig
            ? {
                EncryptionType: 'KMS',
                KeyId: encryptionConfig.keyId,
              }
            : undefined,
        },
      },
    };
  } else if (props.kinesisVideoStreamConfig) {
    if (props.storageType !== 'KINESIS_VIDEO_STREAM') {
      throw new Error(`Storage type mismatch: expected KINESIS_VIDEO_STREAM, got ${props.storageType}`);
    }

    const kinesisVideoStreamConfig =
      props.kinesisVideoStreamConfig as connect.CfnInstanceStorageConfig.KinesisVideoStreamConfigProperty;
    const encryptionConfig =
      kinesisVideoStreamConfig.encryptionConfig as connect.CfnInstanceStorageConfig.EncryptionConfigProperty;
    return {
      InstanceId: instanceId,
      ResourceType: resourceType,
      StorageConfig: {
        StorageType: 'KINESIS_VIDEO_STREAM',
        KinesisVideoStreamConfig: {
          Prefix: kinesisVideoStreamConfig.prefix,
          RetentionPeriodHours: kinesisVideoStreamConfig.retentionPeriodHours,
          EncryptionConfig: {
            EncryptionType: 'KMS',
            KeyId: encryptionConfig.keyId,
          },
        },
      },
    };
  } else if (props.kinesisStreamConfig) {
    if (props.storageType !== 'KINESIS_STREAM') {
      throw new Error(`Storage type mismatch: expected KINESIS_STREAM, got ${props.storageType}`);
    }

    const kinesisStreamConfig =
      props.kinesisStreamConfig as connect.CfnInstanceStorageConfig.KinesisStreamConfigProperty;
    return {
      InstanceId: instanceId,
      ResourceType: resourceType,
      StorageConfig: {
        StorageType: 'KINESIS_STREAM',
        KinesisStreamConfig: {
          StreamArn: kinesisStreamConfig.streamArn,
        },
      },
    };
  } else if (props.kinesisFirehoseConfig) {
    if (props.storageType !== 'KINESIS_FIREHOSE') {
      throw new Error(`Storage type mismatch: expected KINESIS_FIREHOSE, got ${props.storageType}`);
    }

    const kinesisFirehoseConfig =
      props.kinesisFirehoseConfig as connect.CfnInstanceStorageConfig.KinesisFirehoseConfigProperty;
    return {
      InstanceId: instanceId,
      ResourceType: resourceType,
      StorageConfig: {
        StorageType: 'KINESIS_FIREHOSE',
        KinesisFirehoseConfig: {
          FirehoseArn: kinesisFirehoseConfig.firehoseArn,
        },
      },
    };
  }

  throw new Error('No storage config provided');
}
