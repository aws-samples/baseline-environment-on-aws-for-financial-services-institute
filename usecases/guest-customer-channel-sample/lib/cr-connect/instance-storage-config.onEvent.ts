import * as AWS from 'aws-sdk';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

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
  const connect = new AWS.Connect();
  const ret = await connect.associateInstanceStorageConfig(event.ResourceProperties.Parameters).promise();
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

  const connect = new AWS.Connect();
  const ret = await connect
    .updateInstanceStorageConfig({
      ...event.ResourceProperties.Parameters,
      AssociationId: associationId,
    })
    .promise();
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

  const connect = new AWS.Connect();
  const ret = await connect
    .disassociateInstanceStorageConfig({
      InstanceId: event.ResourceProperties.Parameters.InstanceId,
      AssociationId: associationId,
      ResourceType: event.ResourceProperties.Parameters.ResourceType,
    })
    .promise();
  console.log(`connect.disassociateInstanceStorageConfig() => %o`, ret);

  return {
    Data: {
      AssociationId: associationId,
    },
  };
}
