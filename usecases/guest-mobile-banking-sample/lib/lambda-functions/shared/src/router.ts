import { APIGatewayProxyResult } from 'aws-lambda';

export interface RouteHandler {
  method: string;
  pathPattern: string[];
  handler: (params: Record<string, string>, body?: any) => Promise<APIGatewayProxyResult>;
}

export interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
}

/**
 * パスとメソッドに基づいてルートをマッチングする
 */
export function matchRoute(path: string, method: string, routes: RouteHandler[]): RouteMatch | null {
  const pathParts = path.split('/').filter((p) => p !== '');

  for (const route of routes) {
    if (route.method !== method || route.pathPattern.length !== pathParts.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matches = true;

    for (let i = 0; i < route.pathPattern.length; i++) {
      const pattern = route.pathPattern[i];
      const pathPart = pathParts[i];

      if (pattern.startsWith(':')) {
        // パラメータ部分（:id, :transactionId など）
        params[pattern.slice(1)] = pathPart;
      } else if (pattern !== pathPart) {
        // 固定パス部分が一致しない
        matches = false;
        break;
      }
    }

    if (matches) {
      return { handler: route, params };
    }
  }

  return null;
}

/**
 * ルーティングテーブルを使用してリクエストを処理する
 */
export async function handleRequest(
  path: string,
  method: string,
  body: any,
  routes: RouteHandler[],
): Promise<APIGatewayProxyResult> {
  console.log(`Processing request: ${method} ${path}`);

  // OPTIONS - CORSプリフライトリクエスト
  if (method === 'OPTIONS') {
    return createCorsResponse(200, {}, '');
  }

  const match = matchRoute(path, method, routes);

  if (!match) {
    return createCorsResponse(404, { error: 'Not Found', path, method });
  }

  try {
    return await match.handler.handler(match.params, body);
  } catch (error) {
    console.error('Route handler error:', error);
    return createCorsResponse(500, { error: (error as Error).message });
  }
}

/**
 * CORS対応のレスポンスを作成
 */
export function createCorsResponse(statusCode: number, body: any, message?: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    },
    body: JSON.stringify(message ? { message, ...body } : body),
  };
}
