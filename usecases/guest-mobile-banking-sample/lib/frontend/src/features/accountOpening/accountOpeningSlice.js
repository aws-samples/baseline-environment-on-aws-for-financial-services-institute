import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { submitApplication } from './accountOpeningAPI';

// 口座開設申込を送信
export const submitAccountApplication = createAsyncThunk(
  'accountOpening/submitApplication',
  async (applicationData, { rejectWithValue }) => {
    try {
      const response = await submitApplication(applicationData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'エラーが発生しました');
    }
  },
);

const initialState = {
  applicationData: null,
  tempAccountId: null,
  transactionId: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

const accountOpeningSlice = createSlice({
  name: 'accountOpening',
  initialState,
  reducers: {
    resetAccountOpening: (state) => {
      return initialState;
    },
    setApplicationData: (state, action) => {
      state.applicationData = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // 申込送信
      .addCase(submitAccountApplication.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(submitAccountApplication.fulfilled, (state, action) => {
        state.status = 'succeeded';
        // レスポンス形式に柔軟に対応
        state.tempAccountId = action.payload.accountId || action.payload.id;
        state.transactionId = action.payload.transactionId;
      })
      .addCase(submitAccountApplication.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { resetAccountOpening, setApplicationData } = accountOpeningSlice.actions;

export default accountOpeningSlice.reducer;
