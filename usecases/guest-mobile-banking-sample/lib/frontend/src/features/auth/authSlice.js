import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { login as loginAPI, logout as logoutAPI, verifyToken, getSavedUserInfo } from './authAPI';

// 非同期アクション: ログイン
export const loginUser = createAsyncThunk('auth/loginUser', async ({ loginId, password }, { rejectWithValue }) => {
  try {
    const result = await loginAPI(loginId, password);
    return result;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

// 非同期アクション: ログアウト
export const logoutUser = createAsyncThunk('auth/logoutUser', async (_, { rejectWithValue }) => {
  try {
    await logoutAPI();
    return true;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

// 非同期アクション: トークン検証
export const verifyUserToken = createAsyncThunk('auth/verifyToken', async (_, { rejectWithValue }) => {
  try {
    const result = await verifyToken();
    return result;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

// 初期状態
const initialState = {
  // ユーザー情報
  user: null,
  token: null,
  expiresAt: null,

  // 認証状態
  isAuthenticated: false,
  isLoading: false,

  // エラー状態
  error: null,

  // UI状態
  showLoginForm: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 保存されたユーザー情報から状態を復元
    restoreAuthState: (state) => {
      const savedInfo = getSavedUserInfo();
      if (savedInfo) {
        state.user = savedInfo.user;
        state.token = savedInfo.token;
        state.expiresAt = savedInfo.expiresAt;
        state.isAuthenticated = true;
      }
    },

    // エラーをクリア
    clearError: (state) => {
      state.error = null;
    },

    // ログインフォームの表示/非表示
    setShowLoginForm: (state, action) => {
      state.showLoginForm = action.payload;
    },

    // 認証状態をクリア
    clearAuthState: (state) => {
      state.user = null;
      state.token = null;
      state.expiresAt = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ログイン
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.expiresAt = action.payload.expiresAt;
        state.isAuthenticated = true;
        state.error = null;
        state.showLoginForm = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      })

      // ログアウト
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.expiresAt = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        // ログアウトは失敗してもローカル状態はクリア
        state.user = null;
        state.token = null;
        state.expiresAt = null;
        state.isAuthenticated = false;
        state.error = action.payload;
      })

      // トークン検証
      .addCase(verifyUserToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(verifyUserToken.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.valid) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
        } else {
          state.isAuthenticated = false;
        }
        state.error = null;
      })
      .addCase(verifyUserToken.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload;
      });
  },
});

export const { restoreAuthState, clearError, setShowLoginForm, clearAuthState } = authSlice.actions;

export default authSlice.reducer;
