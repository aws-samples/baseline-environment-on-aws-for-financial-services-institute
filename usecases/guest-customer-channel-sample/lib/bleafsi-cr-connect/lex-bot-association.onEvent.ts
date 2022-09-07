import * as AWS from 'aws-sdk';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType == 'Create' || event.RequestType == 'Update') {
    return await associateBot(event);
  } else if (event.RequestType == 'Delete') {
    return await disassociateBot(event);
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function associateBot(event: OnEventRequest): Promise<OnEventResponse> {
  const connect = new AWS.Connect();
  const ret = await connect
    .associateBot({
      InstanceId: event.ResourceProperties.Parameters.InstanceId,
      LexV2Bot: event.ResourceProperties.Parameters.LexV2Bot,
    })
    .promise();

  console.log(`connect.associateBot() => %o`, ret);

  return {
    PhysicalResourceId: event.ResourceProperties.Parameters.LexV2Bot.AliasArn,
  };
}
async function disassociateBot(event: OnEventRequest): Promise<OnEventResponse> {
  const connect = new AWS.Connect();
  const ret = await connect
    .disassociateBot({
      InstanceId: event.ResourceProperties.Parameters.InstanceId,
      LexV2Bot: event.ResourceProperties.Parameters.LexV2Bot,
    })
    .promise();
  console.log(`connect.disassociateBot() => %o`, ret);
  return {};
}
