import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { verifyJWT, createAuthResponse, createAuthErrorResponse, JWTPayload } from '@online-banking/shared';

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
const secretsClient = new SecretsManagerClient({});

const USERS_TABLE = process.env.USERS_TABLE || '';
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || '';
const JWT_SECRET_ARN = process.env.JWT_SECRET_ARN!;

// JWT秘密鍵をキャッシュ（Lambda実行環境の再利用時のパフォーマンス向上）
let cachedJwtSecret: string | null = null;

interface VerifyTokenResponse {
  success: boolean;
  valid: boolean;
  user?: {
    userId: string;
    email: string;
    customerId: string;
    primaryAccountId: string;
  };
}

/**
 * Secrets ManagerからJWT秘密鍵を取得
 */
async function getJwtSecret(): Promise<string> {
  if (cachedJwtSecret) {
    return cachedJwtSecret;
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: JWT_SECRET_ARN,
    });

    const response = await secretsClient.send(command);
    const secret = JSON.parse(response.SecretString!);
    cachedJwtSecret = secret.password;

    if (!cachedJwtSecret) {
      throw new Error('JWT secret not found in Secrets Manager response');
    }

    return cachedJwtSecret;
  } catch (error) {
    console.error('Failed to get JWT secret from Secrets Manager:', error);
    throw new Error('Failed to retrieve JWT secret');
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Token verification request received');

    // Authorizationヘッダーからトークンを取得
    const authHeader = event.headers.Authorization || event.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createAuthErrorResponse(401, 'Authorization header is required', 'MISSING_TOKEN');
    }

    const token = authHeader.substring(7); // "Bearer " を除去

    // JWTトークンを検証
    const jwtSecret = await getJwtSecret();
    const payload: JWTPayload | null = verifyJWT(token, jwtSecret);

    if (!payload) {
      return createAuthErrorResponse(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }

    // ユーザーの存在確認
    const userResult = (await dynamoDB.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId: payload.userId },
      }) as any,
    )) as { Item?: any };

    if (!userResult.Item) {
      return createAuthErrorResponse(401, 'User not found', 'USER_NOT_FOUND');
    }

    const user = userResult.Item;

    // アカウントの状態チェック
    if (!user.isActive) {
      return createAuthErrorResponse(401, 'Account is disabled', 'ACCOUNT_DISABLED');
    }

    // セッションの存在確認（オプション）
    const sessionResult = (await dynamoDB.send(
      new QueryCommand({
        TableName: SESSIONS_TABLE,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'isActive = :active AND expiresAt > :now',
        ExpressionAttributeValues: {
          ':userId': payload.userId,
          ':active': true,
          ':now': Math.floor(Date.now() / 1000),
        },
        Limit: 1,
      }) as any,
    )) as { Items?: any[] };

    if (!sessionResult.Items || sessionResult.Items.length === 0) {
      return createAuthErrorResponse(401, 'No active session found', 'SESSION_EXPIRED');
    }

    // レスポンス
    const response: VerifyTokenResponse = {
      success: true,
      valid: true,
      user: {
        userId: user.userId,
        email: user.email,
        customerId: user.customerId,
        primaryAccountId: user.primaryAccountId,
      },
    };

    return createAuthResponse(200, response);
  } catch (error) {
    console.error('Token verification error:', error);
    return createAuthErrorResponse(500, 'Internal server error', 'INTERNAL_ERROR');
  }
};
