import axios from 'axios';
import { getApiConfig } from '../../config/api';

// 認証API用のクライアントを動的に作成
const createAuthAPI = async () => {
  const config = await getApiConfig();
  return axios.create({
    baseURL: config.BANKING_API,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.API_KEYS.AUTH,
    },
  });
};

// 動的にAPIクライアントを取得
const getAuthAPI = async () => {
  const authAPI = await createAuthAPI();

  // リクエストインターセプター（トークンを自動付与）
  authAPI.interceptors.request.use(
    (config) => {
      // ログインエンドポイントではAuthorizationヘッダーを追加しない
      if (!config.url?.includes('/auth/login')) {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // レスポンスインターセプター（認証エラー処理）
  authAPI.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // ログインエンドポイントの場合はリダイレクトしない（ログインフォームでエラー表示）
        if (!error.config?.url?.includes('/auth/login')) {
          // 認証エラーの場合、トークンを削除してログイン画面へ
          localStorage.removeItem('authToken');
          localStorage.removeItem('userInfo');
          window.location.href = '/';
        }
      }
      return Promise.reject(error);
    },
  );

  return authAPI;
};

/**
 * ログイン
 */
export const login = async (loginId, password) => {
  try {
    console.log('Attempting login for:', loginId);

    const authAPI = await getAuthAPI();
    const response = await authAPI.post('/api/auth/login', {
      loginId,
      password,
    });

    const { token, user, expiresAt } = response.data;

    // トークンとユーザー情報を保存
    localStorage.setItem('authToken', token);
    localStorage.setItem('userInfo', JSON.stringify(user));
    localStorage.setItem('tokenExpiresAt', expiresAt);

    console.log('Login successful:', user);
    return { token, user, expiresAt };
  } catch (error) {
    console.error('Login error:', error);

    const errorMessage = error.response?.data?.error?.message || 'ログインに失敗しました';
    const errorCode = error.response?.data?.error?.code || 'LOGIN_FAILED';

    throw new Error(`${errorMessage} (${errorCode})`);
  }
};

/**
 * ログアウト
 */
export const logout = async () => {
  try {
    // ローカルストレージからトークンとユーザー情報を削除
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('tokenExpiresAt');

    console.log('Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    // ログアウトは失敗してもローカルデータは削除
    localStorage.removeItem('authToken');
    localStorage.removeItem('userInfo');
    localStorage.removeItem('tokenExpiresAt');
  }
};

/**
 * トークン検証
 */
export const verifyToken = async () => {
  try {
    const authAPI = await getAuthAPI();
    const response = await authAPI.get('/api/auth/verify');
    return response.data;
  } catch (error) {
    console.error('Token verification error:', error);
    throw error;
  }
};

/**
 * 保存されたユーザー情報を取得
 */
export const getSavedUserInfo = () => {
  try {
    const userInfo = localStorage.getItem('userInfo');
    const token = localStorage.getItem('authToken');
    const expiresAt = localStorage.getItem('tokenExpiresAt');

    if (!userInfo || !token) {
      return null;
    }

    // トークンの有効期限チェック
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      // 期限切れの場合はクリア
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('tokenExpiresAt');
      return null;
    }

    return {
      user: JSON.parse(userInfo),
      token,
      expiresAt,
    };
  } catch (error) {
    console.error('Error getting saved user info:', error);
    return null;
  }
};

export default getAuthAPI;
