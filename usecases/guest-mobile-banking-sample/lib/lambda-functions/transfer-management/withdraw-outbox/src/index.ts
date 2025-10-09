import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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
              type: 'WITHDRAW_PROCESSED',
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

  const transactionId = outboxRecord.payload.M.transactionId.S;
  const targetAccountId = outboxRecord.payload.M.targetAccountId.S;
  const amount = Number(outboxRecord.payload.M.amount.N);
  const aggregateId = outboxRecord.payload.M.aggregateId.S;
  const version = Number(outboxRecord.payload.M.version.N);

  // 入金イベントを発行（振込による入金として）
  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: 'banking.transfer',
          DetailType: 'DepositRequested',
          Detail: JSON.stringify({
            transactionId,
            accountId: targetAccountId,
            sourceAccountId: outboxRecord.payload.M.accountId?.S,
            amount,
            timestamp: new Date().toISOString(),
            aggregateId,
            version,
            // 振込種別情報を追加
            transactionType: 'TRANSFER_DEPOSIT',
            transferDetails: {
              sourceAccountId: outboxRecord.payload.M.accountId?.S,
              transferId: transactionId,
              transferType: 'BANK_TRANSFER',
              description: `振込入金: ${outboxRecord.payload.M.accountId?.S || 'UNKNOWN'}から`,
            },
          }),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    }),
  );

  console.log('Successfully processed withdraw and sent deposit event:', {
    transactionId,
    targetAccountId,
    amount,
    aggregateId,
    version,
  });
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

      if (outboxRecord.type.S !== 'withdraw' || outboxRecord.status.S !== 'pending') {
        console.log('Skipping non-withdraw or non-pending record');
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
            description: `振込出金 - Transaction ID: ${transactionId.S}`,
            transactionType: 'TRANSFER_WITHDRAWAL',
            targetAccountId: outboxRecord.payload.M.targetAccountId?.S || 'UNKNOWN',
            transferId: transactionId.S,
          };

          console.log('📤 Sending IAM authenticated withdraw request:', {
            requestData: requestData,
          });

          const result = await coreApiClient.withdrawTransaction(requestData);

          result.targetAccountId = outboxRecord.payload.M.targetAccountId.S;
          result.amount = Number(amount.N);
          console.log('✅ Core API withdraw response received:', {
            status: (result as any).status,
            data: (result as any).data,
          });
          return result;
        });

        // 処理成功を記録し、入金イベントを発行
        await updateOutboxSuccess(id, timestamp, response.data, outboxRecord);
      } catch (error: any) {
        console.error('💥 Error processing withdraw after all retries:', {
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
    console.error('Error in withdraw outbox processor:', error);
    throw error;
  }
};
