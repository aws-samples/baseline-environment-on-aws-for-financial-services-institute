import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword, createAuthResponse, createAuthErrorResponse } from '@online-banking/shared';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});
const dynamoDB = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});
const USERS_TABLE = process.env.USERS_TABLE || '';

interface RegisterRequest {
  customerId: string;
  accountId: string;
  email: string;
  temporaryPassword: string;
  loginId?: string; // オプション：指定されない場合は自動生成
}

interface RegisterResponse {
  success: boolean;
  userId: string;
  loginId: string;
  email: string;
  customerId: string;
  primaryAccountId: string;
  message: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('User registration request received:', JSON.stringify(event, null, 2));

    // リクエストボディの解析
    if (!event.body) {
      return createAuthErrorResponse(400, 'Request body is required', 'MISSING_BODY');
    }

    const { customerId, accountId, email, temporaryPassword, loginId }: RegisterRequest = JSON.parse(event.body);

    // バリデーション
    if (!customerId || !accountId || !email || !temporaryPassword) {
      return createAuthErrorResponse(400, 'All fields are required', 'MISSING_FIELDS');
    }

    // loginIdの生成または検証
    const finalLoginId = loginId || `user${customerId.replace('CUST', '')}`;

    // loginIdの重複チェック
    const existingUserResult = (await dynamoDB.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'LoginIdIndex',
        KeyConditionExpression: 'loginId = :loginId',
        ExpressionAttributeValues: {
          ':loginId': finalLoginId,
        },
        Limit: 1,
      }) as any,
    )) as { Items?: any[] };

    if (existingUserResult.Items && existingUserResult.Items.length > 0) {
      return createAuthErrorResponse(409, 'Login ID already exists', 'LOGIN_ID_EXISTS');
    }

    // customerIdの重複チェック（1顧客1アカウント制限）
    const existingCustomerResult = (await dynamoDB.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'CustomerIdIndex',
        KeyConditionExpression: 'customerId = :customerId',
        ExpressionAttributeValues: {
          ':customerId': customerId,
        },
        Limit: 1,
      }) as any,
    )) as { Items?: any[] };

    if (existingCustomerResult.Items && existingCustomerResult.Items.length > 0) {
      return createAuthErrorResponse(409, 'Customer already has an online banking account', 'CUSTOMER_EXISTS');
    }

    // パスワードをハッシュ化
    const { hash: passwordHash, salt } = await hashPassword(temporaryPassword);

    // ユーザーを作成
    const userId = uuidv4();
    const now = new Date().toISOString();

    const newUser = {
      userId,
      loginId: finalLoginId, // Online-banking独自のログインID
      email,
      passwordHash,
      salt,
      customerId,
      primaryAccountId: accountId,

      // 認証関連
      isActive: true,
      emailVerified: true, // Account Openingで既に検証済み
      loginAttempts: 0,

      // 監査
      createdAt: now,
      updatedAt: now,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: newUser,
      }) as any,
    );

    // レスポンス
    const response: RegisterResponse = {
      success: true,
      userId,
      loginId: finalLoginId,
      email,
      customerId,
      primaryAccountId: accountId,
      message: 'User registered successfully',
    };

    console.log('User registration successful:', finalLoginId, email);
    return createAuthResponse(201, response);
  } catch (error) {
    console.error('User registration error:', error);
    return createAuthErrorResponse(500, 'Internal server error', 'INTERNAL_ERROR');
  }
};
