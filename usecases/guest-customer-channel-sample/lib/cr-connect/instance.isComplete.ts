import * as AWS from 'aws-sdk';
import { IsCompleteRequest, IsCompleteResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

export async function isComplete(event: IsCompleteRequest): Promise<IsCompleteResponse> {
  console.log('event = %o', event);
  if (event.RequestType != 'Create') {
    console.log(`No need to wait for ${event.RequestType}; complete immediately.`);
    return { IsComplete: true };
  }
  const instanceId = event.PhysicalResourceId;
  if (!instanceId) {
    throw Error('isComplete() requires event.PhysicalResourceId');
  }
  const connect = new AWS.Connect();
  const ret = await connect
    .describeInstance({
      InstanceId: instanceId,
    })
    .promise();
  console.log('Instance = %o', ret.Instance);
  if (!ret.Instance) {
    throw new Error('ret.instance is not found');
  }
  const instanceStatus = ret.Instance.InstanceStatus;
  if (instanceStatus == 'CREATION_FAILED') {
    throw new Error(`describeInstance() returned CREATION_FAILED: InstanceId = ${instanceId}`);
  }
  const isComplete = instanceStatus == 'ACTIVE';
  console.log(`InstanceStatus = ${instanceStatus}, IsComplete = ${isComplete}`);
  return {
    IsComplete: isComplete,
    Data: isComplete
      ? {
          ServiceRole: ret.Instance.ServiceRole,
        }
      : undefined,
  };
}
