// bankingSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { getApiConfig } from '../../config/api';

// Banking API用のクライアントを動的に作成
const createBankingAPI = async () => {
  const config = await getApiConfig();
  const api = axios.create({
    baseURL: config.BANKING_API,
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': config.API_KEYS.CUSTOMER,
    },
  });

  // リクエストインターセプター（認証トークンを自動付与）
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // レスポンスインターセプター（エラーハンドリング）
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // 認証エラーの場合、トークンを削除してログイン画面へ
        localStorage.removeItem('authToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpiresAt');
        window.location.href = '/';
      }
      console.error('API Error:', error);
      return Promise.reject({
        message: error.response?.data?.error?.message || 'APIエラーが発生しました',
        status: error.response?.status,
        data: error.response?.data,
      });
    },
  );

  return api;
};

export const fetchBalance = createAsyncThunk('banking/fetchBalance', async (accountId) => {
  try {
    const api = await createBankingAPI();
    const response = await api.get(`/api/balance?accountId=${accountId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || '残高の取得に失敗しました');
  }
});

export const executeTransfer = createAsyncThunk(
  'banking/executeTransfer',
  async (transferData, { rejectWithValue }) => {
    try {
      const api = await createBankingAPI();
      const response = await api.post('/api/transfer', {
        ...transferData,
        accountId: transferData.accountId,
      });

      if (response.status === 202 || response.status === 200) {
        return {
          message: response.data.message,
          transactionId: response.data.transactionId,
          timestamp: response.data.timestamp,
          aggregateId: response.data.aggregateId,
          version: response.data.version,
        };
      }
      throw new Error('振込を受付できませんでした。お時間をあけてもう一度お試しください。');
    } catch (error) {
      console.error('Transfer error:', error);

      // バックエンドからの詳細エラーメッセージを優先的に抽出
      let errorMessage = '振込を受付できませんでした。コールセンターまでお問い合わせください。';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message === 'Network Error') {
        errorMessage = '通信エラーが発生しました。通信環境をご確認ください。';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message && !error.message.includes('Request failed')) {
        errorMessage = error.message;
      }

      return rejectWithValue(errorMessage);
    }
  },
);

export const fetchTransactionHistory = createAsyncThunk('banking/fetchTransactionHistory', async (accountId) => {
  try {
    const api = await createBankingAPI();
    const response = await api.get(`/api/accounts/${accountId}/transactions`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || '取引履歴の取得に失敗しました');
  }
});

// 残高推移データを生成する関数
function generateBalanceHistory(transactions, currentBalance) {
  if (!transactions || currentBalance === null || currentBalance === undefined) return [];

  // 過去2年間の月末日付を生成（横軸の基準）
  const now = new Date();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const monthlyDates = [];
  const current = new Date(twoYearsAgo);
  current.setDate(1); // 月初に設定

  while (current <= now) {
    // 月末日を取得
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    monthlyDates.push(monthEnd.toISOString().split('T')[0]);
    current.setMonth(current.getMonth() + 1);
  }

  // 取引を日付順にソート（古い順）
  const sortedTransactions = [...transactions]
    .filter((tx) => new Date(tx.timestamp) >= twoYearsAgo)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (sortedTransactions.length === 0) {
    // 取引がない場合は全期間で現在の残高を返す
    return monthlyDates.map((date) => ({
      date,
      balance: currentBalance,
    }));
  }

  // 各月末時点での残高を計算
  const balanceHistory = [];

  // 最初の取引時点での残高を逆算
  let initialBalance = currentBalance;

  for (let i = sortedTransactions.length - 1; i >= 0; i--) {
    const tx = sortedTransactions[i];
    // amountは既に符号付きなので、逆算では符号を反転
    initialBalance -= tx.amount;
  }

  initialBalance = Math.max(0, initialBalance);

  // 各月末での残高を計算
  let runningBalance = initialBalance;
  let transactionIndex = 0;

  for (const monthEndDate of monthlyDates) {
    const monthEnd = new Date(monthEndDate + 'T23:59:59');

    // この月末までに発生した取引を処理
    while (transactionIndex < sortedTransactions.length) {
      const tx = sortedTransactions[transactionIndex];
      const txDate = new Date(tx.timestamp);

      if (txDate <= monthEnd) {
        // 取引を残高に反映
        // amountは既に符号付きで来る（入金：正、出金：負）
        runningBalance += tx.amount;
        runningBalance = Math.max(0, runningBalance);
        transactionIndex++;
      } else {
        break;
      }
    }

    balanceHistory.push({
      date: monthEndDate,
      balance: runningBalance,
    });
  }

  // 月末の残高のみを返す（月ごとに集約）
  const monthlyBalances = new Map();
  balanceHistory.forEach((item) => {
    const monthKey = item.date.substring(0, 7); // YYYY-MM
    if (!monthlyBalances.has(monthKey) || item.date > monthlyBalances.get(monthKey).date) {
      monthlyBalances.set(monthKey, item);
    }
  });

  return Array.from(monthlyBalances.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-24); // 最新24ヶ月（2年）のみ
}

const initialState = {
  balance: null,
  lastUpdated: null,
  balanceStatus: 'idle',
  balanceError: null,
  transferStatus: 'idle',
  transferError: null,
  transferResult: null,
  transactionHistory: [],
  transactionHistoryStatus: 'idle',
  transactionHistoryError: null,
  transactionStats: [],
  transactionData: [],
};

const bankingSlice = createSlice({
  name: 'banking',
  initialState,
  reducers: {
    clearBalanceError: (state) => {
      state.balanceError = null;
    },
    clearTransferError: (state) => {
      state.transferError = null;
    },
    resetBankingState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBalance.pending, (state) => {
        state.balanceStatus = 'loading';
        state.balanceError = null;
      })
      .addCase(fetchBalance.fulfilled, (state, action) => {
        state.balanceStatus = 'succeeded';
        state.balance = action.payload.balance;
        state.lastUpdated = action.payload.lastUpdated;
        state.balanceError = null;

        // 取引履歴が既に取得済みの場合は、残高推移データを再生成
        if (state.transactionHistory !== undefined) {
          state.transactionData = generateBalanceHistory(state.transactionHistory, action.payload.balance);
        }
      })
      .addCase(fetchBalance.rejected, (state, action) => {
        state.balanceStatus = 'failed';
        state.balanceError = action.error.message;
      })
      .addCase(executeTransfer.pending, (state) => {
        state.transferStatus = 'loading';
        state.transferError = null;
        state.transferResult = null;
      })
      .addCase(executeTransfer.fulfilled, (state, action) => {
        state.transferStatus = 'succeeded';
        state.transferResult = action.payload;
        state.transferError = null;
      })
      .addCase(executeTransfer.rejected, (state, action) => {
        state.transferStatus = 'failed';
        state.transferError = action.error.message;
        state.transferResult = null;
      })
      .addCase(fetchTransactionHistory.pending, (state) => {
        state.transactionHistoryStatus = 'loading';
        state.transactionHistoryError = null;
      })
      .addCase(fetchTransactionHistory.fulfilled, (state, action) => {
        state.transactionHistoryStatus = 'succeeded';
        state.transactionHistory = action.payload.transactions;

        // 現在の残高を使って残高推移データを生成
        if (state.balance !== null && state.balance !== undefined) {
          state.transactionData = generateBalanceHistory(action.payload.transactions, state.balance);
        }

        state.transactionStats = action.payload.transactions;
      })
      .addCase(fetchTransactionHistory.rejected, (state, action) => {
        state.transactionHistoryStatus = 'failed';
        state.transactionHistoryError = action.error.message;
      });
  },
});

export const { clearBalanceError, clearTransferError, resetBankingState } = bankingSlice.actions;
export default bankingSlice.reducer;
