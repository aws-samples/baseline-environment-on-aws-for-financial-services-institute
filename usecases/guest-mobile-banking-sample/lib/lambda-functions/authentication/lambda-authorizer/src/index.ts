import { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { verifyJWT, JWTPayload } from '@online-banking/shared';

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
const SESSIONS_TABLE = process.env.SESSIONS_TABLE || '';

// IAMポリシーを生成するヘルパー関数
const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>,
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
};

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  try {
    console.log('Lambda Authorizer invoked:', {
      methodArn: event.methodArn,
      authorizationToken: event.authorizationToken ? '[PRESENT]' : '[MISSING]',
    });

    const token = event.authorizationToken;

    // Bearerトークンの形式チェック
    if (!token || !token.startsWith('Bearer ')) {
      console.log('Invalid token format');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    const jwtToken = token.substring(7); // "Bearer " を除去

    // JWTトークンを検証
    const payload: JWTPayload | null = verifyJWT(jwtToken);

    if (!payload) {
      console.log('Invalid JWT token');
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // ユーザーの存在確認
    const userResult = await dynamoDB.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId: payload.userId },
      }),
    );

    if (!userResult.Item) {
      console.log('User not found:', payload.userId);
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    const user = userResult.Item;

    // アカウントの状態チェック
    if (!user.isActive) {
      console.log('Account is disabled:', payload.userId);
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // セッションの存在確認
    const sessionResult = await dynamoDB.send(
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
      }),
    );

    if (!sessionResult.Items || sessionResult.Items.length === 0) {
      console.log('No active session found:', payload.userId);
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    console.log('Authorization successful:', payload.userId);

    // 認証成功 - コンテキストにユーザー情報を含める
    return generatePolicy('user', 'Allow', event.methodArn, {
      userId: user.userId,
      email: user.email,
      customerId: user.customerId,
      primaryAccountId: user.primaryAccountId,
    });
  } catch (error) {
    console.error('Lambda Authorizer error:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};
