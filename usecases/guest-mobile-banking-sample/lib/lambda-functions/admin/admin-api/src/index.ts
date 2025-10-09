import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
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

// 環境変数
const ACCOUNT_OPENING_EVENT_STORE_TABLE = process.env.ACCOUNT_OPENING_EVENT_STORE_TABLE || '';
const EVENT_STORE_TABLE = process.env.EVENT_STORE_TABLE || '';

// ルーティングテーブル定義
const routes: RouteHandler[] = [
  {
    method: 'GET',
    pathPattern: ['admin', 'account-applications'],
    handler: async () => await getAccountApplications(),
  },
  {
    method: 'GET',
    pathPattern: ['admin', 'account-applications', ':applicationId', 'credentials'],
    handler: async (params) => await getApplicationCredentials(params.applicationId),
  },
  {
    method: 'GET',
    pathPattern: ['admin', 'transfer-events', ':transactionId'],
    handler: async (params) => await getTransferEvents(params.transactionId),
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

// 口座開設申請一覧取得
async function getAccountApplications(): Promise<APIGatewayProxyResult> {
  console.log('Getting account applications');

  try {
    // AccountOpeningEventStoreから全ての申請を取得
    const result = (await dynamoDB.send(
      new ScanCommand({
        TableName: ACCOUNT_OPENING_EVENT_STORE_TABLE,
      }) as any,
    )) as { Items?: any[] };

    if (!result.Items || result.Items.length === 0) {
      return createCorsResponse(200, { applications: [] });
    }

    // aggregateId（applicationId）ごとに最新のイベントを取得
    const applicationMap = new Map();

    result.Items.forEach((item) => {
      const aggregateId = item.aggregateId;
      const version = item.version;

      if (!applicationMap.has(aggregateId) || applicationMap.get(aggregateId).version < version) {
        applicationMap.set(aggregateId, item);
      }
    });

    // 申請データを整形
    const applications = Array.from(applicationMap.values()).map((event) => {
      const data = event.data;
      return {
        id: data.id,
        transactionId: data.transactionId,
        applicantName: data.customerInfo?.fullName || '',
        email: data.customerInfo?.email || '',
        phoneNumber: data.customerInfo?.phoneNumber || '',
        idType: data.customerInfo?.idType || '',
        idNumber: data.customerInfo?.idNumber || '',
        status: data.status,
        submittedAt: data.createdAt,
        updatedAt: data.updatedAt,
        confirmedAt: data.confirmedAt,
        completedAt: data.completedAt,
        accountType: data.accountType,
        // 完了済みの場合は認証情報も含める
        loginId: data.loginId,
        accountNumber: data.accountNumber,
        branchCode: data.branchCode,
      };
    });

    // 作成日時の降順でソート
    applications.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return createCorsResponse(200, { applications });
  } catch (error) {
    console.error(`Error in getAccountApplications: ${error}`);
    throw error;
  }
}

// 申請の認証情報取得
async function getApplicationCredentials(applicationId: string): Promise<APIGatewayProxyResult> {
  console.log(`Getting credentials for application: ${applicationId}`);

  try {
    // EventStoreから指定された申請の最新情報を取得
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
    const data = latestEvent.data;

    if (data.status !== 'COMPLETED') {
      return createCorsResponse(400, {
        error: 'Application is not completed yet',
        currentStatus: data.status,
      });
    }

    // 認証情報を返す
    return createCorsResponse(200, {
      applicationId: data.id,
      transactionId: data.transactionId,
      loginId: data.loginId,
      temporaryPassword: data.temporaryPassword,
      accountNumber: data.accountNumber,
      branchCode: data.branchCode,
      completedAt: data.completedAt,
    });
  } catch (error) {
    console.error(`Error in getApplicationCredentials: ${error}`);
    throw error;
  }
}

// 振込イベント参照
async function getTransferEvents(transactionId: string): Promise<APIGatewayProxyResult> {
  console.log(`Getting transfer events for transaction: ${transactionId}`);

  try {
    // EventStoreから振込関連のイベントを取得
    const result = (await dynamoDB.send(
      new ScanCommand({
        TableName: EVENT_STORE_TABLE,
        FilterExpression: 'contains(#data, :transactionId) OR contains(metadata.correlationId, :transactionId)',
        ExpressionAttributeNames: {
          '#data': 'data',
        },
        ExpressionAttributeValues: {
          ':transactionId': transactionId,
        },
      }) as any,
    )) as { Items?: any[] };

    if (!result.Items || result.Items.length === 0) {
      return createCorsResponse(404, { error: 'Transfer events not found' });
    }

    // イベントを時系列順にソート
    const events = result.Items.sort(
      (a: any, b: any) =>
        new Date(a.metadata?.timestamp || a.lastUpdated).getTime() -
        new Date(b.metadata?.timestamp || b.lastUpdated).getTime(),
    ).map((event: any) => ({
      type: event.type,
      status: event.status,
      timestamp: event.metadata?.timestamp || event.lastUpdated,
      formattedTimestamp: new Date(event.metadata?.timestamp || event.lastUpdated).toLocaleString('ja-JP'),
      payload: event.data,
      processHistory: event.processHistory || [],
    }));

    // 処理概要を生成
    const summary = {
      totalEvents: events.length,
      status: events[events.length - 1]?.status || 'unknown',
      startTime: events[0]?.timestamp,
      endTime: events[events.length - 1]?.timestamp,
    };

    return createCorsResponse(200, {
      events,
      summary,
    });
  } catch (error) {
    console.error(`Error in getTransferEvents: ${error}`);
    throw error;
  }
}
