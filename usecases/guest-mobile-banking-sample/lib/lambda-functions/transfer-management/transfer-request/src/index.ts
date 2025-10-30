import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CoreApiClient } from '@online-banking/shared';

import * as crypto from 'crypto';

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
const eventBridge = new EventBridgeClient({});

const EVENT_STORE_TABLE = process.env.EVENT_STORE_TABLE;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME;
const CORE_API_BASE_URL = process.env.CORE_API_BASE_URL;
const _BALANCE_TABLE = process.env.BALANCE_TABLE;

// シンプルHTTPクライアント
class SimpleHttpClient {
  async request(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } = {},
  ): Promise<any> {
    console.log('🌐 HTTP API Request:', {
      url,
      method: options.method || 'GET',
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

// Core Banking APIクライアント
const coreApiClient = new CoreApiClient();

// CORSヘッダーを設定
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
};

function generateTransactionId() {
  return crypto.randomBytes(16).toString('hex');
}

// 口座存在確認と残高確認の関数
async function checkAccountAndBalance(
  accountId: string,
  retryCount = 0,
): Promise<{ exists: boolean; balance: number; error?: string }> {
  try {
    // Core Banking APIから口座情報を取得（IAM認証付き）
    if (!CORE_API_BASE_URL) {
      throw new Error('CORE_API_BASE_URL is not configured');
    }

    const response: any = await coreApiClient.getAccountInfo(accountId);
    const balance = response.balance || 0;

    console.log('✅ Account verification successful:', {
      accountId: accountId,
      balance: balance,
      timestamp: new Date().toISOString(),
    });
    return { exists: true, balance };
  } catch (error: any) {
    console.error(`💥 Error checking account ${accountId}:`, {
      message: error.message,
      coreApiBaseUrl: CORE_API_BASE_URL,
      timestamp: new Date().toISOString(),
    });

    // 404エラーの場合は口座が存在しない
    if (error.statusCode === 404) {
      return { exists: false, balance: 0, error: 'Account not found' };
    }

    // その他のエラーの場合はリトライ
    if (retryCount < 1) {
      console.log('Retrying account check...');
      return await checkAccountAndBalance(accountId, retryCount + 1);
    }

    // リトライ後も失敗した場合はエラーを返す
    return {
      exists: false,
      balance: 0,
      error: `Failed to verify account after ${retryCount + 1} attempts: ${error.message}`,
    };
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Starting Lambda execution');
  console.log('Received event:', JSON.stringify(event, null, 2));

  // OPTIONSリクエストへの対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { sourceAccountId, targetAccountId, amount, description } = body;

    if (!sourceAccountId || !targetAccountId || !amount || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: 'Invalid request. Required fields: sourceAccountId, targetAccountId, amount > 0',
        }),
      };
    }

    // 送金元口座の存在確認と残高確認
    const sourceAccountCheck = await checkAccountAndBalance(sourceAccountId);
    if (!sourceAccountCheck.exists) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: '送金元口座が見つかりません。口座番号をご確認ください。',
          error: sourceAccountCheck.error,
        }),
      };
    }

    // 送金先口座の存在確認
    const targetAccountCheck = await checkAccountAndBalance(targetAccountId);
    if (!targetAccountCheck.exists) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: '送金先口座が見つかりません。口座番号をご確認ください。',
          error: targetAccountCheck.error,
        }),
      };
    }

    // 残高確認
    if (sourceAccountCheck.balance < amount) {
      const transactionId = generateTransactionId();
      const timestamp = new Date().toISOString();
      const aggregateId = `transfer-${transactionId}`;
      const version = 1;

      // 残高不足をEventStoreに記録
      await dynamodb.send(
        new PutCommand({
          TableName: EVENT_STORE_TABLE,
          Item: {
            aggregateId,
            version,
            type: 'TransferRejected',
            data: {
              transactionId,
              sourceAccountId,
              targetAccountId,
              amount,
              currentBalance: sourceAccountCheck.balance,
              description: description || `振込失敗: ${sourceAccountId} → ${targetAccountId}`,
              timestamp,
              reason: 'INSUFFICIENT_BALANCE',
              // 振込種別情報を追加
              transactionType: 'TRANSFER',
              transferDetails: {
                sourceAccountId,
                targetAccountId,
                transferId: transactionId,
                transferType: 'BANK_TRANSFER',
                failureReason: 'INSUFFICIENT_BALANCE',
              },
            },
            metadata: {
              correlationId: transactionId,
              timestamp,
              eventVersion: '1.0',
              transactionCategory: 'TRANSFER_FAILED',
            },
            status: 'REJECTED',
            lastUpdated: timestamp,
            processHistory: [
              {
                status: 'REJECTED',
                timestamp,
                type: 'TransferRejected',
                reason: 'INSUFFICIENT_BALANCE',
              },
            ],
          },
        }) as any,
      );

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: '口座残高が不足しております。振込金額をご確認してください。',
          transactionId,
        }),
      };
    }

    const transactionId = generateTransactionId();
    const timestamp = new Date().toISOString();
    const aggregateId = `transfer-${transactionId}`;
    const version = 1;

    // イベントの作成
    const transferEvent = {
      aggregateId,
      version,
      type: 'TransferRequested',
      data: {
        transactionId,
        sourceAccountId,
        targetAccountId,
        amount,
        description: description || `振込: ${sourceAccountId} → ${targetAccountId}`,
        timestamp,
        // 振込種別を明確化
        transactionType: 'TRANSFER',
        transferDetails: {
          sourceAccountId,
          targetAccountId,
          transferId: transactionId,
          transferType: 'BANK_TRANSFER',
        },
      },
      metadata: {
        correlationId: transactionId,
        timestamp,
        eventVersion: '1.0',
        transactionCategory: 'TRANSFER',
      },
      status: 'RECEIVED',
      lastUpdated: timestamp,
      processHistory: [
        {
          status: 'RECEIVED',
          timestamp,
          type: 'TransferRequested',
          details: {
            sourceAccountId,
            targetAccountId,
            amount,
          },
        },
      ],
    };

    // EventStoreに記録
    await dynamodb.send(
      new PutCommand({
        TableName: EVENT_STORE_TABLE,
        Item: transferEvent,
      }) as any,
    );

    // EventBridgeにイベント発行
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'banking.transfer',
            DetailType: 'WithdrawRequested',
            Detail: JSON.stringify({
              transactionId,
              sourceAccountId,
              targetAccountId,
              amount,
              timestamp,
              aggregateId,
              version,
              // 振込種別情報を追加
              transactionType: 'TRANSFER_WITHDRAWAL',
              transferDetails: {
                transferId: transactionId,
                transferType: 'BANK_TRANSFER',
                description: `振込出金: ${targetAccountId}宛`,
              },
            }),
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      }),
    );

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({
        message: '振込依頼を受け付けました',
        transactionId,
        timestamp,
        aggregateId,
        version,
      }),
    };
  } catch (error: any) {
    console.error('Error processing transfer request:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'システムエラーが発生しました。時間をおいて再度お試しください。',
        error: error.message,
      }),
    };
  }
};
