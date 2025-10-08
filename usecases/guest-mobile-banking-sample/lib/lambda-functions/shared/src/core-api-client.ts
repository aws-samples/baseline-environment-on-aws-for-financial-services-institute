// Core Banking APIクライアント
import { SimpleHttpClient } from './http-client';
import { APIGatewayClient, GetApiKeyCommand } from '@aws-sdk/client-api-gateway';

export class CoreApiClient {
  private httpClient: SimpleHttpClient;
  private baseUrl: string;
  private apiKeyId: string;
  private apiGatewayClient: APIGatewayClient;
  private apiKeyValueCache: string | null = null;

  constructor(baseUrl?: string, apiKeyId?: string) {
    this.httpClient = new SimpleHttpClient();
    this.baseUrl = (baseUrl || process.env.CORE_API_BASE_URL || '').replace(/\/+$/, '');
    this.apiKeyId = apiKeyId || process.env.CORE_API_KEY_ID || '';
    this.apiGatewayClient = new APIGatewayClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

    if (!this.baseUrl) {
      throw new Error('CORE_API_BASE_URL is not configured');
    }
    if (!this.apiKeyId) {
      throw new Error('CORE_API_KEY_ID is not configured');
    }
  }

  // API Key値を取得（キャッシュ機能付き）
  private async getApiKeyValue(): Promise<string> {
    if (this.apiKeyValueCache) {
      return this.apiKeyValueCache;
    }

    try {
      console.log('🔑 Fetching API Key value from API Gateway:', {
        apiKeyId: this.apiKeyId,
        region: process.env.AWS_REGION || 'ap-northeast-1',
      });

      const command = new GetApiKeyCommand({
        apiKey: this.apiKeyId,
        includeValue: true,
      });

      const response = await this.apiGatewayClient.send(command);

      if (!response.value) {
        throw new Error('API Key value not found in response');
      }

      this.apiKeyValueCache = response.value;
      console.log('✅ API Key value retrieved successfully');
      return this.apiKeyValueCache;
    } catch (error) {
      console.error('❌ Failed to get API Key value:', error);
      throw new Error(`Failed to get API Key value: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 口座情報を取得
  async getAccountInfo(accountId: string): Promise<any> {
    const url = `${this.baseUrl}/api/accounts/${accountId}`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending account info request:', {
      accountId: accountId,
      url: url,
    });

    const result = await this.httpClient.request(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKeyValue,
      },
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Account info response received:', result);
    return result.data;
  }

  // 取引履歴を取得
  async getAccountTransactions(accountId: string): Promise<any[]> {
    const url = `${this.baseUrl}/api/accounts/${accountId}/transactions`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending transactions request:', {
      accountId: accountId,
      url: url,
    });

    const result = await this.httpClient.request(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKeyValue,
      },
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Transactions response received:', result);
    // Core APIはオブジェクト形式で返すため、transactionsプロパティを取得
    return result.data?.transactions || [];
  }

  // トランザクション状態を取得
  async getTransactionStatus(transactionId: string, accountId: string): Promise<any> {
    console.log('🏦 Preparing Core Banking API call for transaction status:', {
      coreApiBaseUrl: this.baseUrl,
      transactionId: transactionId,
      accountId: accountId,
    });

    const url = `${this.baseUrl}/api/transaction/${transactionId}`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending transaction status request:', {
      transactionId: transactionId,
      accountId: accountId,
      url: url,
    });

    const result = await this.httpClient.request(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKeyValue,
        x_account_id: accountId,
      },
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Transaction status response received:', result);
    return result.data;
  }

  // 顧客を作成
  async createCustomer(customerData: any): Promise<any> {
    const url = `${this.baseUrl}/api/customers`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending create customer request:', {
      url: url,
      customerData: customerData,
    });

    const result = await this.httpClient.request(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKeyValue,
      },
      body: JSON.stringify(customerData),
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Create customer response received:', result);
    return result.data;
  }

  // 口座を作成
  async createAccount(accountData: any): Promise<any> {
    const url = `${this.baseUrl}/api/accounts`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending create account request:', {
      url: url,
      accountData: accountData,
    });

    const result = await this.httpClient.request(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKeyValue,
      },
      body: JSON.stringify(accountData),
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Create account response received:', result);
    return result.data;
  }

  // 顧客情報を取得
  async getCustomerInfo(customerId: string): Promise<any> {
    const url = `${this.baseUrl}/api/customers/${customerId}`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending get customer info request:', {
      customerId: customerId,
      url: url,
    });

    const result = await this.httpClient.request(url, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKeyValue,
      },
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Get customer info response received:', result);
    return result.data;
  }

  // 出金処理
  async withdrawTransaction(transactionData: any): Promise<any> {
    const url = `${this.baseUrl}/api/transactions/withdraw`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending withdraw transaction request:', {
      url: url,
      transactionData: transactionData,
    });

    const result = await this.httpClient.request(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKeyValue,
      },
      body: JSON.stringify(transactionData),
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Withdraw transaction response received:', result);
    return result.data;
  }

  // 入金処理
  async depositTransaction(transactionData: any): Promise<any> {
    const url = `${this.baseUrl}/api/transactions/deposit`;
    const apiKeyValue = await this.getApiKeyValue();

    console.log('📤 Sending deposit transaction request:', {
      url: url,
      transactionData: transactionData,
    });

    const result = await this.httpClient.request(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKeyValue,
      },
      body: JSON.stringify(transactionData),
      useIamAuth: true, // IAM認証を有効化
    });

    console.log('✅ Deposit transaction response received:', result);
    return result.data;
  }
}
