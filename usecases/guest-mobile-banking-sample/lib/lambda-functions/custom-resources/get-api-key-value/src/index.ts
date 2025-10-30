import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse, Context } from 'aws-lambda';
import { APIGatewayClient, GetApiKeyCommand } from '@aws-sdk/client-api-gateway';

const apiGateway = new APIGatewayClient({});

interface ResourceProperties {
  ApiKeyId: string;
}

export const handler = async (
  event: CloudFormationCustomResourceEvent,
  context: Context,
): Promise<CloudFormationCustomResourceResponse> => {
  console.log('Custom Resource Event:', JSON.stringify(event, null, 2));

  const { RequestType, ResourceProperties } = event;
  const { ApiKeyId } = ResourceProperties as unknown as ResourceProperties;

  try {
    if (RequestType === 'Create' || RequestType === 'Update') {
      // API Keyの値を取得
      const command = new GetApiKeyCommand({
        apiKey: ApiKeyId,
        includeValue: true, // 実際の値を取得
      });

      const response = await apiGateway.send(command);

      if (!response.value) {
        throw new Error(`API Key value not found for ID: ${ApiKeyId}`);
      }

      console.log(`Successfully retrieved API Key value for ID: ${ApiKeyId}`);

      return {
        Status: 'SUCCESS',
        PhysicalResourceId: `api-key-${ApiKeyId}`,
        Data: {
          ApiKeyValue: response.value,
        },
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        StackId: event.StackId,
      };
    }

    if (RequestType === 'Delete') {
      // 削除時は何もしない
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: event.PhysicalResourceId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        StackId: event.StackId,
      };
    }

    throw new Error(`Unsupported request type: ${RequestType}`);
  } catch (error) {
    console.error('Error in custom resource:', error);

    return {
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : String(error),
      PhysicalResourceId: (event as any).PhysicalResourceId || `api-key-${ApiKeyId}`,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      StackId: event.StackId,
    };
  }
};
