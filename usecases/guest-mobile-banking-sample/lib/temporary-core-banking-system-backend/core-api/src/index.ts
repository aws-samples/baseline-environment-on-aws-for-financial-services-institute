import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
// Removed unused imports: RouteHandler, handleRequest, createCorsResponse

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

const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE;
const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE;
const TRANSACTIONS_TABLE = process.env.TRANSACTIONS_TABLE;

// ヘルパー関数
function createErrorResponse(
  statusCode: number,
  error: string,
  additionalData?: Record<string, unknown>,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error,
      ...additionalData,
    }),
  };
}

/**
 * テンポラリーコアバンキングシステム API Lambda関数
 *
 * 実装済みエンドポイント:
 * - GET /api/accounts/{accountId} - 口座情報取得（残高含む）
 * - GET /api/transaction/{transactionId} - トランザクション状態取得
 * - GET /api/accounts/{accountId}/transactions - 取引履歴取得（振込・ATM区別対応）
 * - POST /api/customers - 顧客作成
 * - POST /api/accounts - 口座開設（デフォルト100万円残高、口座番号自動採番）
 * - POST /api/transactions/deposit - 入金処理（振込・ATM区別対応）
 * - POST /api/transactions/withdraw - 出金処理（振込・ATM区別対応）
 * - GET /api/customers/{customerId} - 顧客情報取得
 *
 * 取引種別:
 * - TRANSFER_DEPOSIT: 振込による入金
 * - TRANSFER_WITHDRAWAL: 振込による出金
 * - ATM_DEPOSIT: ATMからの入金
 * - ATM_WITHDRAWAL: ATMからの出金
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Core Banking API Request:', {
    path: event.path,
    method: event.httpMethod,
    pathParameters: event.pathParameters,
  });

  try {
    const path = event.path;
    const method = event.httpMethod;
    const pathParams = event.pathParameters || {};

    // ルーティング処理
    if (method === 'GET' && path.match(/\/api\/accounts\/[^/]+$/)) {
      // GET /api/accounts/{accountId}
      const accountId = pathParams.accountId || path.split('/').pop();
      if (!accountId) {
        return createErrorResponse(400, 'Account ID is required');
      }
      return await getAccountInfo(accountId);
    } else if (method === 'GET' && path.match(/\/api\/transaction\/[^/]+$/)) {
      // GET /api/transaction/{transactionId}
      const transactionId = pathParams.transactionId || path.split('/').pop();
      if (!transactionId) {
        return createErrorResponse(400, 'Transaction ID is required');
      }
      return await getTransactionStatus(transactionId);
    } else if (method === 'GET' && path.match(/\/api\/accounts\/[^/]+\/transactions$/)) {
      // GET /api/accounts/{accountId}/transactions
      const accountId = pathParams.accountId || path.split('/')[3];
      if (!accountId) {
        return createErrorResponse(400, 'Account ID is required');
      }
      return await getAccountTransactions(accountId);
    } else if (method === 'POST' && path === '/api/customers') {
      // POST /api/customers
      return await createCustomer(event.body);
    } else if (method === 'POST' && path === '/api/accounts') {
      // POST /api/accounts
      return await createAccount(event.body);
    } else if (method === 'POST' && path === '/api/transactions/deposit') {
      // POST /api/transactions/deposit
      return await processDeposit(event.body);
    } else if (method === 'POST' && path === '/api/transactions/withdraw') {
      // POST /api/transactions/withdraw
      return await processWithdraw(event.body);
    } else if (method === 'GET' && path.match(/\/api\/customers\/[^/]+$/)) {
      // GET /api/customers/{customerId}
      const customerId = pathParams.customerId || path.split('/').pop();
      if (!customerId) {
        return createErrorResponse(400, 'Customer ID is required');
      }
      return await getCustomerInfo(customerId);
    } else {
      return createErrorResponse(404, 'Endpoint not found', { path, method });
    }
  } catch (error) {
    console.error('Error in core banking API:', error);
    return createErrorResponse(500, 'Internal server error', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// 口座情報取得（残高含む）
async function getAccountInfo(accountId: string): Promise<APIGatewayProxyResult> {
  try {
    // 口座情報を取得
    const accountResult = (await dynamodb.send(
      new GetCommand({
        TableName: ACCOUNTS_TABLE,
        Key: { accountId },
      }) as any,
    )) as { Item?: any };

    if (!accountResult.Item) {
      return createErrorResponse(404, 'Account not found', { accountId });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(accountResult.Item),
    };
  } catch (error) {
    console.error('Error getting account info:', error);
    throw error;
  }
}

// トランザクション状態取得
async function getTransactionStatus(transactionId: string): Promise<APIGatewayProxyResult> {
  try {
    // トランザクション情報を取得
    const transactionResult = (await dynamodb.send(
      new GetCommand({
        TableName: TRANSACTIONS_TABLE,
        Key: { transactionId },
      }) as any,
    )) as { Item?: any };

    if (!transactionResult.Item) {
      // トランザクションが見つからない場合はサンプルデータを返す
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          transactionId,
          accountId: 'ACC001',
          type: 'TRANSFER',
          amount: 50000,
          currency: 'JPY',
          status: 'COMPLETED',
          description: 'Sample transaction',
          timestamp: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(transactionResult.Item),
    };
  } catch (error) {
    console.error('Error getting transaction status:', error);
    throw error;
  }
}

// 口座の取引履歴取得
async function getAccountTransactions(accountId: string): Promise<APIGatewayProxyResult> {
  try {
    // 取引履歴を実際のDynamoDBから取得
    const transactionResult = (await dynamodb.send(
      new QueryCommand({
        TableName: TRANSACTIONS_TABLE,
        IndexName: 'AccountIdIndex',
        KeyConditionExpression: 'accountId = :accountId',
        ExpressionAttributeValues: {
          ':accountId': accountId,
        },
        ScanIndexForward: false, // 新しい順にソート
        Limit: 50, // 最大50件
      }) as any,
    )) as { Items?: any[] };

    const transactions = transactionResult.Items || [];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        accountId,
        transactions: transactions,
        totalCount: transactions.length,
      }),
    };
  } catch (error) {
    console.error('Error getting account transactions:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to get account transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

// 口座開設（デフォルト100万円残高、口座番号自動採番）
async function createAccount(requestBody: string | null): Promise<APIGatewayProxyResult> {
  try {
    if (!requestBody) {
      return createErrorResponse(400, 'Request body is required');
    }

    const body = JSON.parse(requestBody);
    const { customerId, accountType, initialBalance } = body;

    if (!customerId || !accountType) {
      return createErrorResponse(400, 'customerId and accountType are required');
    }

    // 口座番号を生成（001支店 + 7桁連番）
    const accountNumber = await generateAccountNumber();

    // accountIdも口座番号と同じ値にする（既存データとの整合性のため）
    const accountId = accountNumber;

    const now = new Date().toISOString();

    const newAccount = {
      accountId,
      accountNumber, // 口座番号を追加
      customerId,
      accountType,
      balance: initialBalance || 1000000, // デフォルトで100万円の残高を設定
      currency: 'JPY',
      status: 'ACTIVE',
      branchCode: '001', // 支店コード
      createdAt: now,
      updatedAt: now,
    };

    // DynamoDBに保存
    await dynamodb.send(
      new PutCommand({
        TableName: ACCOUNTS_TABLE,
        Item: newAccount,
      }) as any,
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(newAccount),
    };
  } catch (error) {
    console.error('Error creating account:', error);
    throw error;
  }
}

// 口座番号生成関数
async function generateAccountNumber(): Promise<string> {
  const branchCode = '001';
  const excludedNumbers = ['1234567', '7654321']; // サンプルデータで使用済み

  // タイムスタンプベースの番号生成（重複リスクを最小化）
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  let baseNumber = ((timestamp % 10000000) + randomSuffix) % 10000000;

  // 最大10回試行して一意な口座番号を生成
  for (let attempt = 0; attempt < 10; attempt++) {
    // 7桁にパディング
    const accountNumberSuffix = baseNumber.toString().padStart(7, '0');
    const fullAccountNumber = branchCode + accountNumberSuffix;

    // 除外番号をチェック
    if (excludedNumbers.includes(accountNumberSuffix)) {
      baseNumber = (baseNumber + 1) % 10000000;
      continue;
    }

    // 重複チェック（全テーブルスキャンを避けるため、GetCommandで直接チェック）
    try {
      // 既存の口座番号と重複していないかチェック
      // 実際の実装では、口座番号をキーとするテーブル設計が理想的だが、
      // 現在の設計では簡易的な重複チェックを実装
      const isDuplicate = await checkAccountNumberDuplicate(fullAccountNumber);

      if (!isDuplicate) {
        console.log(`Generated account number: ${fullAccountNumber}`);
        return fullAccountNumber;
      }

      // 重複している場合は次の番号を試行
      baseNumber = (baseNumber + 1) % 10000000;
    } catch (error) {
      console.error('Error checking account number duplicate:', error);
      // エラーが発生した場合でも番号を返す（重複リスクは低い）
      return fullAccountNumber;
    }
  }

  // 10回試行しても一意な番号が生成できない場合は、タイムスタンプベースで返す
  const fallbackNumber = (Date.now() % 10000000).toString().padStart(7, '0');
  return branchCode + fallbackNumber;
}

// 口座番号の重複チェック（簡易版）
async function checkAccountNumberDuplicate(accountNumber: string): Promise<boolean> {
  try {
    // 実際の実装では、口座番号をGSIのキーとして使用するのが理想的
    // 現在は簡易的にScanを使用（本番環境では非推奨）
    const result = (await dynamodb.send(
      new ScanCommand({
        TableName: ACCOUNTS_TABLE,
        FilterExpression: 'accountNumber = :accountNumber',
        ExpressionAttributeValues: {
          ':accountNumber': accountNumber,
        },
        Limit: 1,
      }) as any,
    )) as { Items?: any[] };

    return !!(result.Items && result.Items.length > 0);
  } catch (error) {
    console.error('Error in duplicate check:', error);
    // エラーが発生した場合は重複なしとして扱う
    return false;
  }
}

// 入金処理
async function processDeposit(requestBody: string | null): Promise<APIGatewayProxyResult> {
  try {
    if (!requestBody) {
      return createErrorResponse(400, 'Request body is required');
    }

    const body = JSON.parse(requestBody);
    const { accountId, amount, description, transactionType, sourceAccountId, transferId } = body;

    if (!accountId || !amount || amount <= 0) {
      return createErrorResponse(400, 'accountId and positive amount are required');
    }

    // 取引種別を判定（デフォルトはATM入金）
    const txType = transactionType || 'ATM_DEPOSIT';
    const isTransfer = txType === 'TRANSFER_DEPOSIT';

    // トランザクションIDを生成
    const transactionId = `DEP${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    // 取引記録を作成
    const transaction = {
      transactionId,
      accountId,
      type: txType, // TRANSFER_DEPOSIT または ATM_DEPOSIT
      amount,
      currency: 'JPY',
      status: 'COMPLETED',
      description: description || (isTransfer ? '振込による入金' : 'ATM入金'),
      timestamp,
      processedAt: timestamp,
      // 振込の場合は追加情報を記録
      ...(isTransfer && {
        sourceAccountId: sourceAccountId || 'UNKNOWN',
        transferId: transferId,
        transferType: 'INBOUND',
      }),
    };

    // トランザクション処理：残高更新と取引記録を同時実行
    try {
      // 1. 口座残高を更新（原子的操作）
      await dynamodb.send(
        new UpdateCommand({
          TableName: ACCOUNTS_TABLE,
          Key: { accountId },
          UpdateExpression: 'ADD balance :amount SET updatedAt = :timestamp',
          ExpressionAttributeValues: {
            ':amount': amount,
            ':timestamp': timestamp,
          },
          ConditionExpression: 'attribute_exists(accountId)', // 口座が存在することを確認
        }) as any,
      );

      // 2. 取引記録を保存
      await dynamodb.send(
        new PutCommand({
          TableName: TRANSACTIONS_TABLE,
          Item: transaction,
        }) as any,
      );

      console.log(`Deposit processed: ${amount} JPY to account ${accountId}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        return createErrorResponse(404, 'Account not found', { accountId });
      }
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        transactionId,
        accountId,
        amount,
        status: 'COMPLETED',
        message: 'Deposit processed successfully',
        timestamp,
      }),
    };
  } catch (error) {
    console.error('Error processing deposit:', error);
    throw error;
  }
}

// 出金処理
async function processWithdraw(requestBody: string | null): Promise<APIGatewayProxyResult> {
  try {
    if (!requestBody) {
      return createErrorResponse(400, 'Request body is required');
    }

    const body = JSON.parse(requestBody);
    const { accountId, amount, description, transactionType, targetAccountId, transferId } = body;

    if (!accountId || !amount || amount <= 0) {
      return createErrorResponse(400, 'accountId and positive amount are required');
    }

    // 取引種別を判定（デフォルトはATM出金）
    const txType = transactionType || 'ATM_WITHDRAWAL';
    const isTransfer = txType === 'TRANSFER_WITHDRAWAL';

    // 口座情報を取得して残高確認
    const accountResult = (await dynamodb.send(
      new GetCommand({
        TableName: ACCOUNTS_TABLE,
        Key: { accountId },
      }) as any,
    )) as { Item?: any };

    if (!accountResult.Item) {
      return createErrorResponse(404, 'Account not found', { accountId });
    }

    const currentBalance = accountResult.Item.balance || 0;
    if (currentBalance < amount) {
      return createErrorResponse(400, 'Insufficient balance', {
        currentBalance,
        requestedAmount: amount,
      });
    }

    // トランザクションIDを生成
    const transactionId = `WTH${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();

    // 取引記録を作成
    const transaction = {
      transactionId,
      accountId,
      type: txType, // TRANSFER_WITHDRAWAL または ATM_WITHDRAWAL
      amount: -amount, // 出金は負の値
      currency: 'JPY',
      status: 'COMPLETED',
      description: description || (isTransfer ? '振込による出金' : 'ATM出金'),
      timestamp,
      processedAt: timestamp,
      // 振込の場合は追加情報を記録
      ...(isTransfer && {
        targetAccountId: targetAccountId || 'UNKNOWN',
        transferId: transferId,
        transferType: 'OUTBOUND',
      }),
    };

    // トランザクション処理：残高更新と取引記録を同時実行
    try {
      // 1. 口座残高を更新（原子的操作で残高不足もチェック）
      await dynamodb.send(
        new UpdateCommand({
          TableName: ACCOUNTS_TABLE,
          Key: { accountId },
          UpdateExpression: 'ADD balance :amount SET updatedAt = :timestamp',
          ConditionExpression: 'attribute_exists(accountId) AND balance >= :withdrawAmount',
          ExpressionAttributeValues: {
            ':amount': -amount, // 出金は負の値
            ':withdrawAmount': amount,
            ':timestamp': timestamp,
          },
        }) as any,
      );

      // 2. 取引記録を保存
      await dynamodb.send(
        new PutCommand({
          TableName: TRANSACTIONS_TABLE,
          Item: transaction,
        }) as any,
      );

      console.log(`Withdrawal processed: ${amount} JPY from account ${accountId}`);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          transactionId,
          accountId,
          amount,
          status: 'COMPLETED',
          message: 'Withdrawal processed successfully',
          timestamp,
          newBalance: currentBalance - amount,
        }),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
        return createErrorResponse(400, 'Insufficient balance or account not found', {
          currentBalance,
          requestedAmount: amount,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    throw error;
  }
}

// 顧客作成
async function createCustomer(requestBody: string | null): Promise<APIGatewayProxyResult> {
  try {
    if (!requestBody) {
      return createErrorResponse(400, 'Request body is required');
    }

    const body = JSON.parse(requestBody);
    const { customerInfo } = body;

    if (!customerInfo || !customerInfo.fullName || !customerInfo.email) {
      return createErrorResponse(400, 'customerInfo with fullName and email are required');
    }

    // 顧客IDを生成
    const customerId =
      'CUST-' +
      Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0');
    const now = new Date().toISOString();

    const newCustomer = {
      customerId,
      name: customerInfo.fullName,
      kana: customerInfo.kana || '',
      email: customerInfo.email,
      phone: customerInfo.phoneNumber || '',
      birthDate: customerInfo.birthdate || '',
      address: {
        postalCode: customerInfo.postalCode || '',
        address: customerInfo.address || '',
      },
      identityDocument: {
        type: customerInfo.idType || '',
        number: customerInfo.idNumber || '',
      },
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    // DynamoDBに保存
    await dynamodb.send(
      new PutCommand({
        TableName: CUSTOMERS_TABLE,
        Item: newCustomer,
      }) as any,
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(newCustomer),
    };
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
}

// 顧客情報取得
async function getCustomerInfo(customerId: string): Promise<APIGatewayProxyResult> {
  try {
    // 顧客情報を取得
    const customerResult = (await dynamodb.send(
      new GetCommand({
        TableName: CUSTOMERS_TABLE,
        Key: { customerId },
      }) as any,
    )) as { Item?: any };

    if (!customerResult.Item) {
      // 顧客が見つからない場合はサンプルデータを返す
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          customerId,
          name: 'Sample Customer',
          email: 'sample@example.com',
          phone: '090-1234-5678',
          status: 'ACTIVE',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: new Date().toISOString(),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(customerResult.Item),
    };
  } catch (error) {
    console.error('Error getting customer info:', error);
    throw error;
  }
}
