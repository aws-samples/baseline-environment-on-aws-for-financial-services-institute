// src/store/store.js
import { configureStore } from '@reduxjs/toolkit';
import accountOpeningReducer from '../features/accountOpening/accountOpeningSlice';
import bankingReducer from '../features/banking/bankingSlice';
import uiReducer from '../features/ui/uiSlice';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    accountOpening: accountOpeningReducer,
    banking: bankingReducer,
    ui: uiReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 必要に応じてシリアライズチェックを調整
        ignoredActions: ['banking/executeTransfer/fulfilled', 'banking/executeTransfer/rejected'],
        ignoredPaths: ['banking.transferError', 'banking.transferResult'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
