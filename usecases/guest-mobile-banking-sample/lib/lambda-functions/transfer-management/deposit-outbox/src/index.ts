import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { CoreApiClient, callWithRetry } from '@online-banking/shared';

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
const eventBridge = new EventBridgeClient();

const OUTBOX_TABLE = process.env.OUTBOX_TABLE;
const EVENT_STORE_TABLE = process.env.EVENT_STORE_TABLE;
const CORE_API_BASE_URL = process.env.CORE_API_BASE_URL;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;

// 必須環境変数のチェック
if (!CORE_API_BASE_URL) {
  throw new Error('CORE_API_BASE_URL environment variable is required');
}

const MAX_RETRIES = 3;

// Core Banking APIクライアント
const coreApiClient = new CoreApiClient();

// アウトボックスとEventStoreの更新
async function updateOutboxAndEventStore(
  id: string,
  timestamp: string,
  status: string,
  outboxRecord: any,
  details: any = {},
) {
  console.log('Updating Outbox and EventStore:', {
    id,
    timestamp,
    status,
    details,
  });

  const { aggregateId, version } = outboxRecord.payload.M;

  try {
    // EventStoreを更新
    await dynamodb.send(
      new UpdateCommand({
        TableName: EVENT_STORE_TABLE,
        Key: {
          aggregateId: aggregateId.S,
          version: Number(version.N),
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
          ':timestamp': new Date().toISOString(),
          ':newHistory': [
            {
              status,
              timestamp: new Date().toISOString(),
              type: 'DEPOSIT_PROCESSED',
              ...details,
            },
          ],
        },
      }) as any,
    );

    // Outboxを更新
    await dynamodb.send(
      new UpdateCommand({
        TableName: OUTBOX_TABLE,
        Key: { id, timestamp },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
      }) as any,
    );

    console.log('Successfully updated Outbox and EventStore');
  } catch (error) {
    console.error('Error updating Outbox and EventStore:', error);
    throw error;
  }
}

// 処理成功時の更新処理
async function updateOutboxSuccess(id: string, timestamp: string, result: any, outboxRecord: any) {
  await updateOutboxAndEventStore(id, timestamp, 'completed', outboxRecord, {
    result,
    success: true,
  });

  // 振込完了イベントを発行（メール通知用）
  await publishTransferCompletedEvent(outboxRecord);

  console.log('Successfully completed deposit processing:', {
    transactionId: outboxRecord.payload.M.transactionId.S,
    accountId: outboxRecord.payload.M.accountId.S,
    amount: Number(outboxRecord.payload.M.amount.N),
    aggregateId: outboxRecord.payload.M.aggregateId.S,
    version: Number(outboxRecord.payload.M.version.N),
  });
}

// 振込完了イベントを発行
async function publishTransferCompletedEvent(outboxRecord: any) {
  try {
    console.log('🔍 Outbox record payload:', JSON.stringify(outboxRecord.payload, null, 2));

    const { transactionId, accountId, amount, aggregateId, version } = outboxRecord.payload.M;
    const sourceAccountId = outboxRecord.payload.M.sourceAccountId?.S;

    console.log('🔍 Extracted values:', {
      transactionId: transactionId.S,
      sourceAccountId: sourceAccountId,
      targetAccountId: accountId.S,
      amount: Number(amount.N),
    });

    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'banking.transfer',
            DetailType: 'TransferCompleted',
            Detail: JSON.stringify({
              transactionId: transactionId.S,
              sourceAccountId: sourceAccountId,
              targetAccountId: accountId.S,
              amount: Number(amount.N),
              completedAt: new Date().toISOString(),
              aggregateId: aggregateId.S,
              version: Number(version.N),
            }),
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      }),
    );

    console.log('✅ TransferCompleted event published:', {
      transactionId: transactionId.S,
      sourceAccountId: sourceAccountId,
      targetAccountId: accountId.S,
    });
  } catch (error) {
    console.error('❌ Failed to publish TransferCompleted event:', error);
    // イベント発行失敗は振込処理に影響させない
  }
}

// 処理失敗時の更新処理
async function updateOutboxFailure(id: string, timestamp: string, error: any, outboxRecord: any) {
  console.log('Failed outbox record:', JSON.stringify(outboxRecord, null, 2));

  await updateOutboxAndEventStore(id, timestamp, 'failed', outboxRecord, {
    error,
    success: false,
  });
}

exports.handler = async (event: any) => {
  console.log('Received DynamoDB Stream event:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      if (record.eventName !== 'INSERT') {
        console.log('Skipping non-INSERT event');
        continue;
      }

      const outboxRecord = record.dynamodb.NewImage;

      if (outboxRecord.type.S !== 'deposit' || outboxRecord.status.S !== 'pending') {
        console.log('Skipping non-deposit or non-pending record');
        continue;
      }

      const id = outboxRecord.id.S;
      const timestamp = outboxRecord.timestamp.S;
      const { accountId, amount, transactionId } = outboxRecord.payload.M;

      try {
        // ステータスを処理中に更新
        await updateOutboxAndEventStore(id, timestamp, 'processing', outboxRecord, {
          type: 'PROCESSING_STARTED',
        });

        // リトライ付きで基幹系APIを呼び出し
        console.log('🏦 Preparing Core Banking API call:', {
          coreApiBaseUrl: CORE_API_BASE_URL,
          transactionId: transactionId.S,
          accountId: accountId.S,
          amount: Number(amount.N),
        });

        const response: any = await callWithRetry(async () => {
          const requestData = {
            accountId: accountId.S,
            amount: Number(amount.N),
            description: `振込入金 - Transaction ID: ${transactionId.S}`,
            transactionType: 'TRANSFER_DEPOSIT',
            sourceAccountId: outboxRecord.payload.M.sourceAccountId?.S || 'UNKNOWN',
            transferId: transactionId.S,
          };

          console.log('📤 Sending deposit request:', {
            requestData: requestData,
          });

          const result = await coreApiClient.depositTransaction(requestData);

          result.amount = Number(amount.N);
          console.log('✅ Core API deposit response received:', {
            status: (result as any).status,
            data: (result as any).data,
          });
          return result;
        });

        // 処理成功を記録
        await updateOutboxSuccess(id, timestamp, response.data, outboxRecord);
      } catch (error: any) {
        console.error('💥 Error processing deposit after all retries:', {
          errorMessage: error.message,
          errorCode: error.code,
          statusCode: error.response?.status,
          responseData: error.response?.data,
          coreApiBaseUrl: CORE_API_BASE_URL,
          transactionId: transactionId.S,
          accountId: accountId.S,
          amount: Number(amount.N),
          retryCount: MAX_RETRIES,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });

        await updateOutboxFailure(
          id,
          timestamp,
          {
            message: error.message,
            code: error.response?.status || 'UNKNOWN_ERROR',
            responseData: error.response?.data,
            coreApiBaseUrl: CORE_API_BASE_URL,
            retryCount: MAX_RETRIES,
            fullError: {
              name: error.name,
              message: error.message,
              code: error.code,
              stack: error.stack,
            },
          },
          outboxRecord,
        );
      }
    }

    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    console.error('Error in deposit outbox processor:', error);
    throw error;
  }
};
