import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { v4 as uuidv4 } from 'uuid';
import { RouteHandler, handleRequest, createCorsResponse } from '../../../shared/src/router';

// DynamoDBクライアント
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

// EventBridgeクライアント
const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// 環境変数
const ACCOUNT_OPENING_EVENT_STORE_TABLE = process.env.ACCOUNT_OPENING_EVENT_STORE_TABLE || '';
const ACCOUNT_OPENING_OUTBOX_TABLE = process.env.ACCOUNT_OPENING_OUTBOX_TABLE || '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || '';

// 口座開設申込情報の型定義
interface AccountOpeningApplication {
  id: string;
  transactionId: string;
  customerInfo: {
    fullName: string;
    kana: string;
    email: string;
    phoneNumber: string;
    birthdate: string;
    postalCode: string;
    address: string;
    idType: string;
    idNumber: string;
  };
  accountType: 'SAVINGS' | 'CHECKING';
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  completedAt?: string;
  receiptNotified: boolean;
  completionNotified: boolean;
}

// ルーティングテーブル定義
const routes: RouteHandler[] = [
  {
    method: 'POST',
    pathPattern: ['api', 'accounts'],
    handler: async (_params, body) => await handleAccountApplicationRoute(body),
  },
  {
    method: 'GET',
    pathPattern: ['api', 'accounts', ':applicationId'],
    handler: async (params) => await getAccountApplication(params.applicationId),
  },
  {
    method: 'POST',
    pathPattern: ['api', 'accounts', 'confirm', ':transactionId'],
    handler: async (params, _body) => await confirmAccountApplicationByTransactionId(params.transactionId),
  },
  {
    method: 'POST',
    pathPattern: ['api', 'accounts', 'confirm', ':transactionId', 'reject'],
    handler: async (params, _body) => await rejectAccountApplicationByTransactionId(params.transactionId),
  },
];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = event.body ? JSON.parse(event.body) : null;
    return await handleRequest(event.path, event.httpMethod, body, routes);
  } catch (error) {
    console.error('Error:', error);
    return createCorsResponse(500, { error: (error as Error).message });
  }
};

// 口座開設申込処理（ルーター用）
async function handleAccountApplicationRoute(body: any): Promise<APIGatewayProxyResult> {
  console.log('Handling account application');

  if (!body) {
    return createCorsResponse(400, { error: 'Request body is required' });
  }
  console.log('Request body:', JSON.stringify(body, null, 2));

  // 申込IDとトランザクションIDを生成
  const applicationId = 'APP-' + uuidv4().substring(0, 8);
  const transactionId = 'TRX-' + uuidv4().substring(0, 8);

  // フロントエンドからのリクエスト形式に対応
  // customerInfo オブジェクトまたはフラット構造の両方をサポート
  const customerInfo = body.customerInfo || {
    fullName: body.fullName || '',
    email: body.email || '',
    phoneNumber: body.phone || '',
    birthDate: body.birthdate || '',
  };

  // 申込情報を作成
  const application: AccountOpeningApplication = {
    id: applicationId,
    transactionId: transactionId,
    customerInfo: {
      fullName: customerInfo.fullName || body.fullName || '',
      kana: body.kana || '',
      email: customerInfo.email || body.email || '',
      phoneNumber: customerInfo.phoneNumber || body.phone || '',
      birthdate: customerInfo.birthDate || body.birthdate || '',
      postalCode: body.postalCode || body.address?.postalCode || '',
      address: body.address?.streetAddress || body.address || '',
      idType: customerInfo.idType || body.idType || '',
      idNumber: customerInfo.idNumber || body.idNumber || '',
    },
    accountType: body.type === '普通預金' ? 'SAVINGS' : body.type || body.accountType || 'SAVINGS',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptNotified: false,
    completionNotified: false,
  };

  console.log(`Creating application: ${JSON.stringify(application, null, 2)}`);

  try {
    // EventStoreに申込作成イベントを保存
    const createEvent = {
      aggregateId: applicationId,
      version: 1,
      type: 'AccountOpeningApplicationCreated',
      data: application,
      metadata: {
        correlationId: transactionId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
      },
      status: 'pending',
      lastUpdated: new Date().toISOString(),
      processHistory: [
        {
          status: 'created',
          timestamp: new Date().toISOString(),
          type: 'application_created',
        },
      ],
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        Item: createEvent,
      }) as any,
    );

    // Outboxテーブルにイベントを記録（トランザクションアウトボックスパターン）
    const outboxRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      aggregateId: applicationId,
      eventType: 'AccountOpeningApplicationCreated',
      status: 'pending',
      payload: {
        applicationId: applicationId,
        transactionId: transactionId,
        customerInfo: application.customerInfo,
        accountType: application.accountType,
        action: 'notify_receipt', // 受付通知
      },
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: ACCOUNT_OPENING_OUTBOX_TABLE,
        Item: outboxRecord,
      }) as any,
    );

    // EventBridgeにイベントを発行
    await publishEvent('AccountOpeningApplicationCreated', {
      applicationId: applicationId,
      transactionId: transactionId,
      customerInfo: application.customerInfo,
      accountType: application.accountType,
      status: 'PENDING',
    });

    // フロントエンドが期待する形式でレスポンス
    return createCorsResponse(201, {
      id: applicationId,
      transactionId: transactionId,
      status: 'PENDING',
    });
  } catch (error) {
    console.error(`Error in handleAccountApplication: ${error}`);
    throw error;
  }
}

// 申込状態確認処理
async function getAccountApplication(applicationId: string): Promise<APIGatewayProxyResult> {
  console.log(`Getting application: ${applicationId}`);

  try {
    // EventStoreから最新の申込情報を取得
    const result = (await dynamoDB.send(
      new ScanCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        FilterExpression: 'aggregateId = :aggregateId',
        ExpressionAttributeValues: {
          ':aggregateId': applicationId,
        },
      }) as any,
    )) as { Items?: any[] };

    if (!result.Items || result.Items.length === 0) {
      return createCorsResponse(404, { error: 'Application not found' });
    }

    // 最新バージョンのイベントを取得
    const latestEvent = result.Items.sort((a: any, b: any) => b.version - a.version)[0];

    // フロントエンドが期待する形式でレスポンス
    return createCorsResponse(200, latestEvent.data);
  } catch (error) {
    console.error(`Error in getAccountApplication: ${error}`);
    throw error;
  }
}

// 申込確認処理（applicationId指定）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function confirmAccountApplication(applicationId: string): Promise<APIGatewayProxyResult> {
  console.log(`Confirming application: ${applicationId}`);

  try {
    // 既存の申込情報を取得
    const existingResult = (await dynamoDB.send(
      new ScanCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        FilterExpression: 'aggregateId = :aggregateId',
        ExpressionAttributeValues: {
          ':aggregateId': applicationId,
        },
      }) as any,
    )) as { Items?: any[] };

    if (!existingResult.Items || existingResult.Items.length === 0) {
      return createCorsResponse(404, { error: 'Application not found' });
    }

    const latestEvent = existingResult.Items.sort((a: any, b: any) => b.version - a.version)[0];
    const currentApplication = latestEvent.data as AccountOpeningApplication;

    if (currentApplication.status !== 'PENDING') {
      return createCorsResponse(400, {
        error: 'Application cannot be confirmed',
        currentStatus: currentApplication.status,
      });
    }

    // 確認済み状態に更新
    const confirmedApplication: AccountOpeningApplication = {
      ...currentApplication,
      status: 'CONFIRMED',
      updatedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    };

    // EventStoreに確認イベントを保存
    const confirmEvent = {
      aggregateId: applicationId,
      version: latestEvent.version + 1,
      type: 'AccountOpeningApplicationConfirmed',
      data: confirmedApplication,
      metadata: {
        correlationId: currentApplication.transactionId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
      },
      status: 'pending',
      lastUpdated: new Date().toISOString(),
      processHistory: [
        ...latestEvent.processHistory,
        {
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          type: 'application_confirmed',
        },
      ],
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        Item: confirmEvent,
      }) as any,
    );

    // Outboxテーブルにイベントを記録（口座開設処理用）
    const outboxRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      aggregateId: applicationId,
      eventType: 'AccountOpeningApplicationConfirmed',
      status: 'pending',
      payload: {
        applicationId: applicationId,
        transactionId: currentApplication.transactionId,
        customerInfo: confirmedApplication.customerInfo,
        accountType: confirmedApplication.accountType,
        action: 'create_account', // Core Banking APIで口座作成
      },
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: ACCOUNT_OPENING_OUTBOX_TABLE,
        Item: outboxRecord,
      }) as any,
    );

    // EventBridgeにイベントを発行
    await publishEvent('AccountOpeningApplicationConfirmed', {
      applicationId: applicationId,
      transactionId: currentApplication.transactionId,
      customerInfo: confirmedApplication.customerInfo,
      accountType: confirmedApplication.accountType,
      status: 'CONFIRMED',
    });

    return createCorsResponse(200, {
      id: applicationId,
      status: 'CONFIRMED',
    });
  } catch (error) {
    console.error(`Error confirming application: ${error}`);
    throw error;
  }
}

// 申込却下処理（transactionId指定）- 管理者用
async function rejectAccountApplicationByTransactionId(transactionId: string): Promise<APIGatewayProxyResult> {
  console.log(`Rejecting application by transactionId: ${transactionId}`);

  try {
    // transactionIdで申込情報を検索
    const existingResult = (await dynamoDB.send(
      new ScanCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        FilterExpression: '#data.transactionId = :transactionId',
        ExpressionAttributeNames: {
          '#data': 'data',
        },
        ExpressionAttributeValues: {
          ':transactionId': transactionId,
        },
      }) as any,
    )) as { Items?: any[] };

    if (!existingResult.Items || existingResult.Items.length === 0) {
      return createCorsResponse(404, {
        error: 'Application not found with the provided transaction ID',
      });
    }

    const latestEvent = existingResult.Items.sort((a, b) => b.version - a.version)[0];
    const currentApplication = latestEvent.data as AccountOpeningApplication;
    const applicationId = currentApplication.id;

    if (currentApplication.status !== 'PENDING') {
      return createCorsResponse(400, {
        error: 'Application cannot be rejected',
        currentStatus: currentApplication.status,
      });
    }

    // 却下状態に更新
    const rejectedApplication: AccountOpeningApplication = {
      ...currentApplication,
      status: 'REJECTED',
      updatedAt: new Date().toISOString(),
    };

    // EventStoreに却下イベントを保存
    const rejectEvent = {
      aggregateId: applicationId,
      version: latestEvent.version + 1,
      type: 'AccountOpeningApplicationRejected',
      data: rejectedApplication,
      metadata: {
        correlationId: currentApplication.transactionId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
      },
      status: 'rejected',
      lastUpdated: new Date().toISOString(),
      processHistory: [
        ...latestEvent.processHistory,
        {
          status: 'rejected',
          timestamp: new Date().toISOString(),
          type: 'application_rejected',
        },
      ],
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        Item: rejectEvent,
      }) as any,
    );

    // EventBridgeにイベントを発行
    await publishEvent('AccountOpeningApplicationRejected', {
      applicationId: applicationId,
      transactionId: currentApplication.transactionId,
      customerInfo: rejectedApplication.customerInfo,
      accountType: rejectedApplication.accountType,
      status: 'REJECTED',
    });

    return createCorsResponse(200, {
      id: applicationId,
      transactionId: transactionId,
      status: 'REJECTED',
    });
  } catch (error) {
    console.error(`Error rejecting application by transactionId: ${error}`);
    throw error;
  }
}

// 申込確認処理（transactionId指定）- フロントエンドとの互換性のため
async function confirmAccountApplicationByTransactionId(transactionId: string): Promise<APIGatewayProxyResult> {
  console.log(`Confirming application by transactionId: ${transactionId}`);

  try {
    // transactionIdで申込情報を検索
    const existingResult = (await dynamoDB.send(
      new ScanCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        FilterExpression: '#data.transactionId = :transactionId',
        ExpressionAttributeNames: {
          '#data': 'data',
        },
        ExpressionAttributeValues: {
          ':transactionId': transactionId,
        },
      }) as any,
    )) as { Items?: any[] };

    if (!existingResult.Items || existingResult.Items.length === 0) {
      return createCorsResponse(404, {
        error: 'Application not found with the provided transaction ID',
      });
    }

    const latestEvent = existingResult.Items.sort((a, b) => b.version - a.version)[0];
    const currentApplication = latestEvent.data as AccountOpeningApplication;
    const applicationId = currentApplication.id;

    if (currentApplication.status !== 'PENDING') {
      return createCorsResponse(400, {
        error: 'Application cannot be confirmed',
        currentStatus: currentApplication.status,
      });
    }

    // 確認済み状態に更新
    const confirmedApplication: AccountOpeningApplication = {
      ...currentApplication,
      status: 'CONFIRMED',
      updatedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    };

    // EventStoreに確認イベントを保存
    const confirmEvent = {
      aggregateId: applicationId,
      version: latestEvent.version + 1,
      type: 'AccountOpeningApplicationConfirmed',
      data: confirmedApplication,
      metadata: {
        correlationId: currentApplication.transactionId,
        timestamp: new Date().toISOString(),
        eventVersion: '1.0',
      },
      status: 'pending',
      lastUpdated: new Date().toISOString(),
      processHistory: [
        ...latestEvent.processHistory,
        {
          status: 'confirmed',
          timestamp: new Date().toISOString(),
          type: 'application_confirmed',
        },
      ],
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
        Item: confirmEvent,
      }) as any,
    );

    // Outboxテーブルにイベントを記録（口座開設処理用）
    const outboxRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      aggregateId: applicationId,
      eventType: 'AccountOpeningApplicationConfirmed',
      status: 'pending',
      payload: {
        applicationId: applicationId,
        transactionId: currentApplication.transactionId,
        customerInfo: confirmedApplication.customerInfo,
        accountType: confirmedApplication.accountType,
        action: 'create_account', // Core Banking APIで口座作成
      },
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: ACCOUNT_OPENING_OUTBOX_TABLE,
        Item: outboxRecord,
      }) as any,
    );

    // EventBridgeにイベントを発行
    await publishEvent('AccountOpeningApplicationConfirmed', {
      applicationId: applicationId,
      transactionId: currentApplication.transactionId,
      customerInfo: confirmedApplication.customerInfo,
      accountType: confirmedApplication.accountType,
      status: 'CONFIRMED',
    });

    return createCorsResponse(200, {
      id: applicationId,
      transactionId: transactionId,
      status: 'CONFIRMED',
    });
  } catch (error) {
    console.error(`Error confirming application by transactionId: ${error}`);
    throw error;
  }
}

// EventBridgeイベント発行ヘルパー
async function publishEvent(detailType: string, detail: any): Promise<void> {
  try {
    const params = {
      Entries: [
        {
          Source: 'banking.account-opening',
          DetailType: detailType,
          Detail: JSON.stringify(detail),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    };

    const result = await eventBridgeClient.send(new PutEventsCommand(params));
    console.log(`Event published: ${detailType}`, result);
  } catch (error) {
    console.error(`Failed to publish event ${detailType}:`, error);
    throw error;
  }
}
