import * as AWS from 'aws-sdk';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType == 'Create' || event.RequestType == 'Update') {
    return await getPromptArn(event);
  } else if (event.RequestType == 'Delete') {
    console.log('No action required for delete');
    return {};
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function getPromptArn(event: OnEventRequest): Promise<OnEventResponse> {
  const connect = new AWS.Connect();
  const ret = await connect
    .listPrompts({
      InstanceId: event.ResourceProperties.Parameters.InstanceId,
    })
    .promise();
  console.log(`connect.listPrompts() => %o`, ret);

  if (!ret.PromptSummaryList) {
    return {};
  }
  const prompt = ret.PromptSummaryList.find((p) => {
    return p.Name && p.Name == event.ResourceProperties.Parameters.PromptName;
  });

  console.log(`returning prompt => %o`, prompt);
  return {
    PhysicalResourceId: prompt?.Arn,
    Data: {
      PromptArn: prompt?.Arn,
      PromptId: prompt?.Id,
    },
  };
}
