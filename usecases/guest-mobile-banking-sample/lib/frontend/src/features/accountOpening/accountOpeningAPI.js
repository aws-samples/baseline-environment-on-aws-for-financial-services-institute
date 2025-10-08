import axios from 'axios';
import { getApiConfig } from '../../config/api';

// 口座開設API用のクライアントを動的に作成
const createAccountOpeningAPI = async () => {
  const config = await getApiConfig();
  const apiClient = axios.create({
    baseURL: config.BANKING_API,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Api-Key': config.API_KEYS.CUSTOMER,
    },
    timeout: 15000,
  });

  // エラーハンドリングを強化
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', error);
      return Promise.reject({
        message: error.response?.data?.error || '通信エラーが発生しました',
        statusCode: error.response?.status || 500,
        originalError: error,
      });
    },
  );

  return apiClient;
};

// 口座開設申込を送信
export const submitApplication = async (applicationData) => {
  try {
    const apiClient = await createAccountOpeningAPI();
    const config = await getApiConfig();

    console.log('API Endpoint:', config.BANKING_API);
    console.log('Submitting application data:', applicationData);

    // APIに送信するデータ構造 - バックエンドが期待する形式に合わせる
    const apiData = {
      customerInfo: {
        fullName: applicationData.fullName || '',
        email: applicationData.email || '',
        phoneNumber: applicationData.phone || '',
        birthDate: applicationData.birthdate || '',
        idType: applicationData.idType || '',
        idNumber: applicationData.idNumber || '',
      },
      address: {
        postalCode: applicationData.postalCode || '',
        prefecture: '東京都',
        city: '千代田区',
        streetAddress: applicationData.address || '',
      },
      type: '普通預金',
      initialBalance: 0,
    };

    console.log('Transformed API data:', apiData);

    const response = await apiClient.post('/api/accounts', apiData);
    console.log('API Response:', response.data);

    // バックエンドのレスポンス形式に対応
    // レスポンス: { id, transactionId, status }
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// 注意: 以下の関数は非同期処理のため使用しません
// - confirmApplication: 申込確認（バックエンドで自動処理）
// - checkApplicationStatus: 状態確認（メール通知で完了をお知らせ）
// - pollAccountStatus: ポーリング（不要）
