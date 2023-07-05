import * as AWS from 'aws-sdk';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType == 'Create') {
    return await createInstance(event);
  } else if (event.RequestType == 'Update') {
    return await updateInstance(event);
  } else if (event.RequestType == 'Delete') {
    return await deleteInstance(event);
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function createInstance(event: OnEventRequest): Promise<OnEventResponse> {
  const connect = new AWS.Connect();
  const ret = await connect
    .createInstance({
      InstanceAlias: event.ResourceProperties.InstanceAlias,
      InboundCallsEnabled: JSON.parse(event.ResourceProperties.InboundCallsEnabled),
      OutboundCallsEnabled: JSON.parse(event.ResourceProperties.OutboundCallsEnabled),
      IdentityManagementType: event.ResourceProperties.IdentityManagementType,
      ClientToken: event.ResourceProperties.ClientToken,
      DirectoryId: event.ResourceProperties.DirectoryId,
    })
    .promise();

  console.log(`connect.createInstance() => %o`, ret);

  return {
    PhysicalResourceId: ret.Id,
    Data: {
      InstanceId: ret.Id,
    },
  };
}
async function updateInstance(event: OnEventRequest): Promise<OnEventResponse> {
  const instanceId = event.PhysicalResourceId;
  if (!instanceId) {
    throw Error('updateInstance() requires event.PhysicalResourceId');
  }

  const connect = new AWS.Connect();
  const updateInboundRet = await connect
    .updateInstanceAttribute({
      InstanceId: instanceId,
      AttributeType: 'INBOUND_CALLS',
      Value: event.ResourceProperties.InboundCallsEnabled,
    })
    .promise();
  console.log(`connect.updateInstanceAttribute(INBOUND_CALLS) => %o`, updateInboundRet);

  const updateOutboundRet = await connect
    .updateInstanceAttribute({
      InstanceId: instanceId,
      AttributeType: 'OUTBOUND_CALLS',
      Value: event.ResourceProperties.OutboundCallsEnabled,
    })
    .promise();
  console.log(`connect.updateInstanceAttribute(OUTBOUND_CALLS) => %o`, updateOutboundRet);

  const describeRet = await connect
    .describeInstance({
      InstanceId: instanceId,
    })
    .promise();
  console.log(`connect.describeInstance() => %o`, describeRet);
  if (!describeRet.Instance) {
    throw Error('describeInstance() returned null instance');
  }

  return {
    Data: {
      InstanceId: instanceId,
      ServiceRole: describeRet.Instance.ServiceRole,
    },
  };
}
async function deleteInstance(event: OnEventRequest): Promise<OnEventResponse> {
  const instanceId = event.PhysicalResourceId;
  if (!instanceId) {
    throw Error('deleteInstance() requires event.PhysicalResourceId');
  }

  const connect = new AWS.Connect();
  const ret = await connect
    .deleteInstance({
      InstanceId: instanceId,
    })
    .promise();
  console.log(`connect.deleteInstance() => %o`, ret);
  return {
    Data: {
      InstanceId: instanceId,
    },
  };
}
