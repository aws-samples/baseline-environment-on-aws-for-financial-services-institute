import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CoreApiClient, processTransaction, getCurrentTimestamp } from '@online-banking/shared';

const DEFAULT_LIMIT = 10;

// 取引履歴を取得
async function fetchTransactions(accountId: string, retryCount = 0): Promise<any> {
  try {
    const coreApiClient = new CoreApiClient();

    // Core Banking APIから取引履歴を取得
    const transactions = await coreApiClient.getAccountTransactions(accountId);

    // 取引履歴を処理
    const processedTransactions = transactions.map(processTransaction);

    return {
      accountId,
      transactions: processedTransactions,
      totalCount: processedTransactions.length,
      limit: DEFAULT_LIMIT,
      lastUpdated: getCurrentTimestamp(),
    };
  } catch (error: any) {
    if (retryCount < 1) {
      console.log('Retrying transactions fetch...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await fetchTransactions(accountId, retryCount + 1);
    }

    // API呼び出しが失敗した場合はエラーを投げる
    console.error('Failed to fetch transactions after retries:', {
      error: error.message,
      accountId,
      retryCount: retryCount + 1,
    });

    throw new Error(`Failed to fetch transactions for ${accountId}: ${error.message}`);
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Received transactions request:', JSON.stringify(event, null, 2));

  try {
    // パスパラメータから口座IDを取得
    const accountId = event.pathParameters?.id;

    if (!accountId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Account ID is required in path parameter',
        }),
      };
    }

    const transactionData = await fetchTransactions(accountId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      },
      body: JSON.stringify(transactionData),
    };
  } catch (error: any) {
    console.error('Error processing transactions request:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'システムエラーが発生しました。時間をおいて再度お試しください。',
      }),
    };
  }
};
