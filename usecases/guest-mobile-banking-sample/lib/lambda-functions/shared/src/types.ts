// 共通型定義

// 認証関連の型定義
export interface User {
  userId: string;
  loginId: string;
  customerId: string;
  primaryAccountId: string;
  email: string;
  passwordHash: string;
  salt: string;
  isActive: boolean;
  loginAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface JWTPayload {
  userId: string;
  sessionId: string;
  email: string;
  customerId: string;
  primaryAccountId: string;
  iat?: number;
  exp?: number;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  customerId: string;
  primaryAccountId: string;
  email: string;
  expiresAt: number;
}

export interface Account {
  accountId: string;
  customerId: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT';
  balance: number;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN';
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  transactionId: string;
  accountId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  amount: number;
  currency: string;
  description: string;
  timestamp: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  metadata?: Record<string, any>;
}

export interface TransferEvent {
  aggregateId: string;
  version: number;
  type: string;
  data: {
    transactionId: string;
    sourceAccountId: string;
    targetAccountId: string;
    amount: number;
    description: string;
    timestamp: string;
  };
  metadata: {
    correlationId: string;
    timestamp: string;
    eventVersion: string;
  };
  status: string;
  lastUpdated: string;
  processHistory: Array<{
    status: string;
    timestamp: string;
    type: string;
    [key: string]: any;
  }>;
}

export interface OutboxRecord {
  id: string;
  timestamp: string;
  type: 'withdraw' | 'deposit';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: {
    accountId: string;
    targetAccountId?: string;
    amount: number;
    transactionId: string;
    aggregateId: string;
    version: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateAccountRequest {
  customerId: string;
  accountType: Account['accountType'];
  initialBalance?: number;
  currency?: string;
}

export interface CreateTransactionRequest {
  accountId: string;
  type: Transaction['type'];
  amount: number;
  description: string;
  currency?: string;
}

export interface TransferRequest {
  sourceAccountId: string;
  targetAccountId: string;
  amount: number;
  description?: string;
}

// 口座開設関連の型定義
export interface AccountOpeningApplication {
  id: string;
  transactionId: string;
  customerInfo: {
    fullName: string;
    kana: string;
    email: string;
    phoneNumber: string;
    birthdate: string;
    postalCode: string;
    address: string;
    idType: string;
    idNumber: string;
  };
  accountType: 'SAVINGS' | 'CHECKING';
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  completedAt?: string;
  receiptNotified: boolean;
  completionNotified: boolean;
}

export interface AccountOpeningRequest {
  // フロントエンドからの直接フィールド
  fullName?: string;
  kana?: string;
  email?: string;
  phone?: string;
  birthdate?: string;
  postalCode?: string;
  address?:
    | string
    | {
        postalCode?: string;
        streetAddress?: string;
      };
  idType?: string;
  idNumber?: string;
  type?: string; // '普通預金' など
  accountType?: 'SAVINGS' | 'CHECKING';

  // または customerInfo オブジェクト形式
  customerInfo?: {
    fullName: string;
    email: string;
    phoneNumber: string;
    birthDate: string;
  };
}
