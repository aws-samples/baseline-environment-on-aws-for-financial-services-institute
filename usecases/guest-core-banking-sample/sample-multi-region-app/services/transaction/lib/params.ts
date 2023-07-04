import { ParamTableName, ddbClient } from './dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

const caches: { [key: string]: { ttl: number; value: string } } = {};

export const getStopFlag = async (defaultValue: boolean) => {
  return getBooleanFlag('stopFlag', defaultValue);
};

export const getBooleanFlag = async (key: string, defaultValue: boolean) => {
  if (caches[key]?.ttl > Date.now()) {
    return caches[key].value ? caches[key].value == 'true' : defaultValue;
  }
  try {
    const res = await ddbClient.send(
      new GetCommand({
        TableName: ParamTableName,
        Key: {
          PK: key,
        },
      }),
    );
    caches[key] = { ttl: Date.now() + 10 * 1000, value: res.Item?.value };
    return caches[key].value ? caches[key].value == 'true' : defaultValue;
  } catch (e) {
    // should not stop if there is an error
    return defaultValue;
  }
};
