import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
  endpoint: process.env.DYNAMODB_ENDPOINT,
});
export const ddbClient = DynamoDBDocumentClient.from(client);

export const MainTableName = process.env.MAIN_TABLE_NAME ?? 'test_main';
export const ParamTableName = process.env.PARAM_TABLE_NAME ?? 'test_param';

export const DummySk = ' ';
