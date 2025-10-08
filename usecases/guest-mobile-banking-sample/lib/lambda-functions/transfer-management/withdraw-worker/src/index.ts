import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQSEvent, SQSHandler } from 'aws-lambda';

const dynamodbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const dynamodb = DynamoDBDocumentClient.from(dynamodbClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

const OUTBOX_TABLE = process.env.OUTBOX_TABLE;
const EVENT_STORE_TABLE = process.env.EVENT_STORE_TABLE;

async function updateEventStore(aggregateId: string, version: string | number, status: string, details: any) {
  console.log('Updating EventStore:', { aggregateId, version, status, details });
  const timestamp = new Date().toISOString();

  try {
    const versionNumber = Number(version);
    if (isNaN(versionNumber)) {
      throw new Error(`Invalid version number: ${version}`);
    }

    await dynamodb.send(
      new UpdateCommand({
        TableName: EVENT_STORE_TABLE,
        Key: {
          aggregateId,
          version: versionNumber,
        },
        UpdateExpression:
          'SET #status = :status, #lastUpdated = :timestamp, #history = list_append(#history, :newHistory)',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#lastUpdated': 'lastUpdated',
          '#history': 'processHistory',
        },
        ExpressionAttributeValues: {
          ':status': status,
          ':timestamp': timestamp,
          ':newHistory': [
            {
              status,
              timestamp,
              type: 'WITHDRAW_REQUESTED',
              ...details,
            },
          ],
        },
      }) as any,
    );
    console.log('EventStore updated successfully');
  } catch (error) {
    console.error('Error updating EventStore:', error);
    throw error;
  }
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      const body = JSON.parse(record.body);
      const detail = typeof body.detail === 'string' ? JSON.parse(body.detail) : body.detail;

      console.log('Processing withdraw message:', JSON.stringify(detail, null, 2));

      const { transactionId, sourceAccountId, targetAccountId, amount, timestamp, aggregateId, version } = detail;

      if (!aggregateId || version == null) {
        throw new Error(`Missing required fields - aggregateId: ${aggregateId}, version: ${version}`);
      }

      const outboxRecord = {
        id: `withdraw-${transactionId}`,
        timestamp: timestamp || new Date().toISOString(),
        type: 'withdraw',
        status: 'pending',
        payload: {
          accountId: sourceAccountId,
          targetAccountId,
          amount,
          transactionId,
          aggregateId,
          version: Number(version),
        },
      };

      try {
        // EventStoreのステータスを更新
        await updateEventStore(aggregateId, version, 'WITHDRAW_REQUESTED', {
          outboxRecordId: outboxRecord.id,
          sourceAccountId,
          targetAccountId,
          amount,
        });

        // Outboxテーブルに記録
        await dynamodb.send(
          new PutCommand({
            TableName: OUTBOX_TABLE,
            Item: outboxRecord,
            ConditionExpression: 'attribute_not_exists(id)',
          }) as any,
        );

        console.log('Successfully created outbox record:', outboxRecord);
      } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
          console.log(`Duplicate transaction detected, skipping: ${transactionId}`);
          continue;
        }
        throw error;
      }
    }

    // SQSHandlerは戻り値不要
  } catch (error) {
    console.error('Error processing withdraw requests:', error);
    throw error;
  }
};
