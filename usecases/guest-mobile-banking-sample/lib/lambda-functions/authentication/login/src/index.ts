import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  verifyPassword,
  generateJWT,
  generateSessionId,
  createAuthResponse,
  createAuthErrorResponse,
  JWTPayload,
  SessionData,
} from '@online-banking/shared';

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

interface LoginRequest {
  loginId: string; // メールアドレスからloginIdに変更
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    userId: string;
    loginId: string;
    email: string;
    customerId: string;
    primaryAccountId: string;
  };
  expiresAt: string;
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
    console.log('=== LOGIN DEBUG START ===');
    console.log('Login request received for loginId:', JSON.parse(event.body || '{}').loginId);

    // リクエストボディの解析
    if (!event.body) {
      console.log('DEBUG: Missing request body');
      return createAuthErrorResponse(400, 'Request body is required', 'MISSING_BODY');
    }

    const { loginId, password }: LoginRequest = JSON.parse(event.body);
    console.log('DEBUG: Parsed loginId:', loginId);
    console.log('DEBUG: Password length:', password?.length);

    // バリデーション
    if (!loginId || !password) {
      console.log('DEBUG: Missing credentials - loginId:', !!loginId, 'password:', !!password);
      return createAuthErrorResponse(400, 'Login ID and password are required', 'MISSING_CREDENTIALS');
    }

    console.log('DEBUG: Querying DynamoDB with table:', USERS_TABLE);
    console.log('DEBUG: Using LoginIdIndex for loginId:', loginId);

    // Online Banking App のユーザーテーブルからloginIdで認証情報を取得
    const userResult = (await dynamoDB.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'LoginIdIndex',
        KeyConditionExpression: 'loginId = :loginId',
        ExpressionAttributeValues: {
          ':loginId': loginId,
        },
        Limit: 1,
      }) as any,
    )) as any;

    console.log('DEBUG: DynamoDB query result count:', userResult.Items?.length || 0);

    if (!userResult.Items || userResult.Items.length === 0) {
      console.log('DEBUG: User not found for loginId:', loginId);
      return createAuthErrorResponse(401, 'Invalid login ID or password', 'INVALID_CREDENTIALS');
    }

    const user = userResult.Items[0];
    console.log('DEBUG: Found user:', user.userId, 'isActive:', user.isActive);

    // ユーザー情報を使用（Core Banking呼び出し不要）
    // const customerInfo = { email: user.email };

    // アカウントの状態チェック
    if (!user.isActive) {
      console.log('DEBUG: Account is disabled for user:', user.userId);
      return createAuthErrorResponse(401, 'Account is disabled', 'ACCOUNT_DISABLED');
    }

    // ログイン試行回数チェック
    console.log('DEBUG: Login attempts:', user.loginAttempts);
    if (user.loginAttempts >= 5) {
      const lockUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
      if (lockUntil && lockUntil > new Date()) {
        console.log('DEBUG: Account is locked until:', lockUntil);
        return createAuthErrorResponse(401, 'Account is temporarily locked', 'ACCOUNT_LOCKED');
      }
    }

    // パスワード検証
    console.log('DEBUG: Verifying password...');
    console.log('DEBUG: Stored hash:', user.passwordHash);
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    console.log('DEBUG: Password validation result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('DEBUG: Password validation failed for user:', user.userId);
      // ログイン失敗回数を増加
      await dynamoDB.send(
        new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId: user.userId },
          UpdateExpression: 'SET loginAttempts = loginAttempts + :inc, updatedAt = :now',
          ExpressionAttributeValues: {
            ':inc': 1,
            ':now': new Date().toISOString(),
          },
        }) as any,
      );

      return createAuthErrorResponse(401, 'Invalid login ID or password', 'INVALID_CREDENTIALS');
    }

    console.log('DEBUG: Login successful for user:', user.userId);

    // ログイン成功 - 試行回数をリセット
    console.log('DEBUG: Resetting login attempts for user:', user.userId);
    await dynamoDB.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression: 'SET loginAttempts = :zero, lastLoginAt = :now, updatedAt = :now REMOVE lockedUntil',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':now': new Date().toISOString(),
        },
      }) as any,
    );

    // JWTトークン生成
    console.log('DEBUG: Generating JWT token...');
    const sessionId = generateSessionId();
    const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.userId,
      sessionId: sessionId, // sessionIdをJWTに含める
      email: user.email,
      customerId: user.customerId,
      primaryAccountId: user.primaryAccountId,
    };

    const jwtSecret = await getJwtSecret();
    const token = generateJWT(jwtPayload, jwtSecret);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15分後
    console.log('DEBUG: JWT token generated, sessionId:', sessionId);

    // セッション情報を保存
    console.log('DEBUG: Saving session to table:', SESSIONS_TABLE);
    const sessionData: SessionData = {
      sessionId,
      userId: user.userId,
      customerId: user.customerId,
      primaryAccountId: user.primaryAccountId,
      email: user.email,
      expiresAt: Math.floor(expiresAt.getTime() / 1000), // TTL用のUnixタイムスタンプ
    };

    console.log('DEBUG: Session data to save:', {
      sessionId,
      userId: user.userId,
      expiresAt: sessionData.expiresAt,
      expiresAtDate: new Date(sessionData.expiresAt * 1000).toISOString(),
      currentTime: Date.now(),
      currentTimeDate: new Date().toISOString(),
    });

    await dynamoDB.send(
      new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: {
          ...sessionData,
          createdAt: new Date().toISOString(),
          isActive: true,
          ipAddress: event.requestContext.identity?.sourceIp,
          userAgent: event.headers['User-Agent'],
        },
      }) as any,
    );

    console.log('DEBUG: Session saved successfully');

    console.log('DEBUG: Session saved successfully');

    // レスポンス
    const response: LoginResponse = {
      token,
      user: {
        userId: user.userId,
        loginId: user.loginId,
        email: user.email,
        customerId: user.customerId,
        primaryAccountId: user.primaryAccountId,
      },
      expiresAt: expiresAt.toISOString(),
    };

    console.log('DEBUG: Returning successful response for user:', user.loginId);
    console.log('=== LOGIN DEBUG END (SUCCESS) ===');
    return createAuthResponse(200, response);
  } catch (error) {
    console.error('=== LOGIN DEBUG END (ERROR) ===');
    console.error('Login error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return createAuthErrorResponse(500, 'Internal server error', 'INTERNAL_ERROR');
  }
};
