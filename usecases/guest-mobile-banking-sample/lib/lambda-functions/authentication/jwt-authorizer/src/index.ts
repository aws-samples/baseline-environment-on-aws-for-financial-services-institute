import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as jwt from 'jsonwebtoken';
import { JWTPayload } from '@online-banking/shared';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({});

const USERS_TABLE = process.env.USERS_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const JWT_SECRET_ARN = process.env.JWT_SECRET_ARN!;

// JWT秘密鍵をキャッシュ（Lambda実行環境の再利用時のパフォーマンス向上）
let cachedJwtSecret: string | null = null;

interface User {
  userId: string;
  loginId: string;
  customerId: string;
  isActive: boolean;
}

interface Session {
  sessionId: string;
  userId: string;
  expiresAt: number;
  isActive: boolean;
}

/**
 * JWT Token Authorizer
 * 既存のverify-token機能を活用したAPI Gateway Authorizer
 */
export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: Context,
): Promise<APIGatewayAuthorizerResult> => {
  console.log('JWT Authorizer invoked:', JSON.stringify(event, null, 2));

  try {
    // Authorizationヘッダーからトークンを抽出
    const token = extractToken(event.authorizationToken);
    if (!token) {
      throw new Error('No token provided');
    }

    // JWTトークンを検証
    const payload = await verifyJWT(token);

    // セッション検証
    console.log('DEBUG: Verifying session:', payload.sessionId);
    const session = await getSession(payload.sessionId);
    console.log('DEBUG: Session found:', !!session);
    if (session) {
      console.log('DEBUG: Session details:', {
        sessionId: session.sessionId,
        isActive: session.isActive,
        expiresAt: session.expiresAt,
        expiresAtMs: session.expiresAt * 1000,
        currentTime: Date.now(),
        isExpired: session.expiresAt * 1000 < Date.now(),
      });
    }

    // expiresAtは秒単位のUnixタイムスタンプなので、ミリ秒に変換して比較
    const sessionExpiresAtMs = session ? session.expiresAt * 1000 : 0;
    if (!session || !session.isActive || sessionExpiresAtMs < Date.now()) {
      console.log(
        'DEBUG: Session validation failed - session:',
        !!session,
        'isActive:',
        session?.isActive,
        'expired:',
        session ? sessionExpiresAtMs < Date.now() : 'N/A',
      );
      throw new Error('Invalid or expired session');
    }

    // ユーザー情報を取得
    const user = await getUser(payload.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // 認証成功 - Allow policy を返す
    return generatePolicy(user.userId, 'Allow', event.methodArn, {
      userId: user.userId,
      customerId: user.customerId,
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error('Authorization failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      authorizationToken: event.authorizationToken ? 'present' : 'missing',
      methodArn: event.methodArn,
    });
    // 認証失敗 - Deny policy を返す
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};

/**
 * Authorizationヘッダーからトークンを抽出
 */
function extractToken(authorizationToken: string): string | null {
  if (!authorizationToken) {
    return null;
  }

  // "Bearer <token>" 形式から token 部分を抽出
  const parts = authorizationToken.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  // Bearer なしの場合はそのまま返す
  return authorizationToken;
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

/**
 * JWTトークンを検証
 */
async function verifyJWT(token: string): Promise<JWTPayload> {
  try {
    const jwtSecret = await getJwtSecret();
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    if (!decoded.userId || !decoded.sessionId) {
      throw new Error('Invalid token payload');
    }

    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    throw new Error('Invalid token');
  }
}

/**
 * セッション情報を取得
 */
async function getSession(sessionId: string): Promise<Session | null> {
  try {
    console.log('DEBUG: Getting session from table:', SESSIONS_TABLE, 'sessionId:', sessionId);
    const result = await docClient.send(
      new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
      }),
    );

    console.log('DEBUG: Session query result:', result.Item ? 'found' : 'not found');
    return result.Item as Session | null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * ユーザー情報を取得
 */
async function getUser(userId: string): Promise<User | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      }),
    );

    return result.Item as User | null;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

/**
 * IAM Policy を生成
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>,
): APIGatewayAuthorizerResult {
  const authResponse: APIGatewayAuthorizerResult = {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: effect === 'Allow' ? resource.replace(/\/[^/]+\/api\/.*$/, '/*/api/*') : resource,
        },
      ],
    },
  };

  // コンテキスト情報を追加（Lambda関数で利用可能）
  if (context && effect === 'Allow') {
    authResponse.context = context;
  }

  return authResponse;
}
