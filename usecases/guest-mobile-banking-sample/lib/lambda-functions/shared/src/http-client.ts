// IAM署名付きHTTPクライアント（共通化）
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';

export interface HttpClientOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  useIamAuth?: boolean; // IAM認証を使用するかどうか
}

export interface HttpClientResponse {
  data: any;
  status: number;
}

export class SimpleHttpClient {
  private signer: SignatureV4;

  constructor() {
    // AWS Signature V4 signer を初期化
    this.signer = new SignatureV4({
      service: 'execute-api',
      region: process.env.AWS_REGION || 'ap-northeast-1',
      credentials: defaultProvider(),
      sha256: Sha256,
    });
  }

  async request(url: string, options: HttpClientOptions = {}): Promise<HttpClientResponse> {
    console.log('🌐 HTTP API Request:', {
      url,
      method: options.method || 'GET',
      useIamAuth: options.useIamAuth || false,
      timestamp: new Date().toISOString(),
    });

    const requestOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body,
    };

    // IAM認証が必要な場合は署名を追加
    if (options.useIamAuth) {
      try {
        const urlObj = new URL(url);

        const request = {
          method: options.method || 'GET',
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          protocol: urlObj.protocol,
          headers: {
            'Content-Type': 'application/json',
            host: urlObj.hostname,
            ...options.headers,
          },
          body: options.body,
        };

        console.log('🔐 Signing request with IAM credentials...', {
          method: request.method,
          hostname: request.hostname,
          path: request.path,
          protocol: request.protocol,
          region: process.env.AWS_REGION || 'ap-northeast-1',
          service: 'execute-api',
        });

        const signedRequest = await this.signer.sign(request);

        console.log('🔐 Signed request headers:', {
          authorization: signedRequest.headers?.Authorization ? '[PRESENT]' : '[MISSING]',
          'x-amz-date': signedRequest.headers?.['X-Amz-Date'] ? '[PRESENT]' : '[MISSING]',
          'x-amz-security-token': signedRequest.headers?.['X-Amz-Security-Token'] ? '[PRESENT]' : '[MISSING]',
          headerCount: Object.keys(signedRequest.headers || {}).length,
        });

        // 署名されたヘッダーを使用
        requestOptions.headers = {
          ...requestOptions.headers,
          ...signedRequest.headers,
        };

        console.log('✅ Request signed successfully');
      } catch (error) {
        console.error('❌ Failed to sign request:', error);
        throw new Error(`Failed to sign request: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // HTTP リクエスト実行
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: url,
        method: options.method || 'GET',
        useIamAuth: options.useIamAuth || false,
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { data, status: response.status };
  }
}

// リトライ機能付きAPI呼び出し
export async function callWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error = new Error('Unknown error occurred');

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      console.log(`🚀 API call attempt ${retryCount + 1}/${maxRetries}`);
      const result = await apiCall();
      console.log(`✅ API call succeeded on attempt ${retryCount + 1}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ API call failed (attempt ${retryCount + 1}/${maxRetries}):`, {
        errorMessage: lastError.message,
        errorCode: (error as any)?.code,
        statusCode: (error as any)?.response?.status,
        responseData: (error as any)?.response?.data,
        timestamp: new Date().toISOString(),
      });

      if (retryCount < maxRetries - 1) {
        const delay = Math.pow(2, retryCount) * baseDelay + Math.random() * 200 - 100;
        console.log(`⏳ Waiting ${delay}ms before retry ${retryCount + 2}...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
