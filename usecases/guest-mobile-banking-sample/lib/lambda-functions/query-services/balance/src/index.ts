import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CoreApiClient, processTransaction, getCurrentTimestamp } from '@online-banking/shared';

const DEFAULT_LIMIT = 10;

// 残高情報を取得
async function fetchBalanceData(accountId: string, retryCount = 0): Promise<any> {
  try {
    const coreApiClient = new CoreApiClient();

    // Core Banking APIから口座情報と最近の取引履歴を取得
    const [accountInfo, transactions] = await Promise.all([
      coreApiClient.getAccountInfo(accountId),
      coreApiClient.getAccountTransactions(accountId),
    ]);

    // 取引履歴を処理（最新のもののみ）
    const processedTransactions = transactions.map(processTransaction).slice(0, DEFAULT_LIMIT);

    return {
      balance: accountInfo.balance,
      lastUpdated: getCurrentTimestamp(),
      recentTransactions: processedTransactions,
      transactionCount: transactions.length,
      accountInfo: {
        accountId: accountInfo.accountId,
        accountType: accountInfo.accountType,
        currency: accountInfo.currency,
        status: accountInfo.status,
      },
    };
  } catch (error: any) {
    if (retryCount < 1) {
      console.log('Retrying balance data fetch...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return await fetchBalanceData(accountId, retryCount + 1);
    }

    // API呼び出しが失敗した場合はエラーを投げる
    console.error('Failed to fetch balance data after retries:', {
      error: error.message,
      accountId,
      retryCount: retryCount + 1,
    });

    throw new Error(`Failed to fetch balance data for ${accountId}: ${error.message}`);
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Received balance request:', JSON.stringify(event, null, 2));

  try {
    // クエリパラメータから口座IDを取得
    const accountId = event.queryStringParameters?.accountId;

    if (!accountId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'accountId is required as query parameter',
        }),
      };
    }

    const balanceData = await fetchBalanceData(accountId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      },
      body: JSON.stringify(balanceData),
    };
  } catch (error: any) {
    console.error('Error processing balance request:', error);

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
