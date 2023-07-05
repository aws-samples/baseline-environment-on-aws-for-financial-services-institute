import * as AWS from 'aws-sdk';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType == 'Create' || event.RequestType == 'Update') {
    return await getQueueArn(event);
  } else if (event.RequestType == 'Delete') {
    console.log('No action required for delete');
    return {};
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function getQueueArn(event: OnEventRequest): Promise<OnEventResponse> {
  const connect = new AWS.Connect();
  const ret = await connect
    .listQueues({
      InstanceId: event.ResourceProperties.Parameters.InstanceId,
    })
    .promise();
  console.log(`connect.listQueues() => %o`, ret);

  if (!ret.QueueSummaryList) {
    return {};
  }
  const queue = ret.QueueSummaryList.find((q) => {
    return q.Name && q.Name == event.ResourceProperties.Parameters.QueueName;
  });

  console.log(`returning queue => %o`, queue);
  return {
    PhysicalResourceId: queue?.Arn,
    Data: {
      QueueArn: queue?.Arn,
      QueueId: queue?.Id,
    },
  };
}
