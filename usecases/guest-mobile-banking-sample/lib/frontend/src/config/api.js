// API設定の一元管理
// 全環境でconfig.jsonから設定を読み込む

let configCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5秒間キャッシュ

// 設定を動的に取得する関数
export const getApiConfig = async () => {
  const now = Date.now();

  // キャッシュが有効な場合はキャッシュを返す
  if (configCache && now - lastFetchTime < CACHE_DURATION) {
    return configCache;
  }

  try {
    // config.jsonを動的に読み込み
    const response = await fetch('/config.json', {
      cache: 'no-cache', // キャッシュを無効化
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (response.ok) {
      const config = await response.json();
      configCache = {
        BANKING_API: config.REACT_APP_BANKING_API || 'https://api.example.com/v1/',
        API_KEYS: {
          CUSTOMER: config.REACT_APP_CUSTOMER_API_KEY || '',
          ADMIN: config.REACT_APP_ADMIN_API_KEY || '',
          AUTH: config.REACT_APP_AUTH_API_KEY || '',
        },
      };
      lastFetchTime = now;
      return configCache;
    }
  } catch (error) {
    console.warn('config.jsonの読み込みに失敗しました:', error);
  }

  // フォールバック: window.APP_CONFIGまたはデフォルト設定
  const fallbackConfig = window.APP_CONFIG || {
    BANKING_API: 'https://api.example.com/v1/',
    API_KEYS: {
      CUSTOMER: '',
      ADMIN: '',
      AUTH: '',
    },
  };

  configCache = fallbackConfig;
  lastFetchTime = now;
  return fallbackConfig;
};

// 同期版（後方互換性のため）
export const getApiConfigSync = () => {
  return (
    configCache ||
    window.APP_CONFIG || {
      BANKING_API: 'https://api.example.com/v1/',
      API_KEYS: {
        CUSTOMER: '',
        ADMIN: '',
        AUTH: '',
      },
    }
  );
};

// APIクライアント作成関数（非同期版）
export const createApiClient = async () => {
  const config = await getApiConfig();
  return {
    baseURL: config.BANKING_API,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.API_KEYS.CUSTOMER,
    },
  };
};

// 後方互換性のためのデフォルトエクスポート（非推奨）
// 新しいコードでは getApiConfig() を使用してください
const API_CONFIG = {
  get BANKING_API() {
    return getApiConfigSync().BANKING_API;
  },
  get API_KEYS() {
    return getApiConfigSync().API_KEYS;
  },
};

export default API_CONFIG;
