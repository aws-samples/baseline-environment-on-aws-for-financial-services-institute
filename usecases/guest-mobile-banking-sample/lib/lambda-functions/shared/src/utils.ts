import { ApiResponse } from './types';

// API レスポンス作成
export const createResponse = <T>(statusCode: number, body: ApiResponse<T>): any => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify(body),
});

// エラーレスポンス作成
export const createErrorResponse = (statusCode: number, message: string, code?: string) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify({
    error: {
      code: code || 'UNKNOWN_ERROR',
      message,
      timestamp: new Date().toISOString(),
    },
  }),
});

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export const validateAmount = (amount: number): boolean => {
  return typeof amount === 'number' && amount > 0 && Number.isFinite(amount);
};

export const formatCurrency = (amount: number, currency = 'JPY'): string => {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency,
  }).format(amount);
};

// EventStore更新用のヘルパー関数
export const createEventStoreUpdate = (aggregateId: string, version: number, status: string, details: any = {}) => ({
  aggregateId,
  version,
  status,
  lastUpdated: getCurrentTimestamp(),
  processHistory: [
    {
      status,
      timestamp: getCurrentTimestamp(),
      ...details,
    },
  ],
});

// Outboxレコード作成用のヘルパー関数
export const createOutboxRecord = (type: 'withdraw' | 'deposit', transactionId: string, payload: any) => ({
  id: `${type}-${transactionId}`,
  timestamp: getCurrentTimestamp(),
  type,
  status: 'pending',
  payload,
});
