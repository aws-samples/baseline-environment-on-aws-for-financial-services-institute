import { CreateTableCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { MainTableName, ParamTableName, ddbClient } from './lib/dynamodb';

// initialize the tables (intended for DynamoDB local)
const createTable = async () => {
  try {
    // create the main table
    try {
      await ddbClient.send(
        new CreateTableCommand({
          TableName: MainTableName,
          KeySchema: [
            {
              AttributeName: 'PK',
              KeyType: 'HASH',
            },
            {
              AttributeName: 'SK',
              KeyType: 'RANGE',
            },
          ],
          AttributeDefinitions: [
            {
              AttributeName: 'PK',
              AttributeType: 'S',
            },
            {
              AttributeName: 'SK',
              AttributeType: 'S',
            },
            {
              AttributeName: 'GSI1',
              AttributeType: 'S',
            },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'GSI1',
              KeySchema: [
                {
                  AttributeName: 'GSI1',
                  KeyType: 'HASH',
                },
              ],
              Projection: {
                ProjectionType: 'ALL',
              },
              ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
              },
            },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        }),
      );
    } catch (e: any) {
      if (e.name != 'ResourceInUseException') {
        throw e;
      }
    }

    console.log(`created the main table. ${MainTableName}`);

    try {
      // create the parameter table
      await ddbClient.send(
        new CreateTableCommand({
          TableName: ParamTableName,
          KeySchema: [
            {
              AttributeName: 'PK',
              KeyType: 'HASH',
            },
          ],
          AttributeDefinitions: [
            {
              AttributeName: 'PK',
              AttributeType: 'S',
            },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        }),
      );
      await ddbClient.send(
        new PutItemCommand({
          TableName: ParamTableName,
          Item: {
            PK: { S: 'stopFlag' },
            value: { S: 'false' },
          },
        }),
      );
    } catch (e: any) {
      if (e.name != 'ResourceInUseException') {
        throw e;
      }
    }

    console.log(`created the param table. ${ParamTableName}`);
  } catch (err) {
    console.log('Error', err);
    throw err;
  }
};

createTable();
