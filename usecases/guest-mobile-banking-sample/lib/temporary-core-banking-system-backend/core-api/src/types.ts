// 顧客情報
export interface CoreCustomer {
  customerId: string;
}

// 口座情報
export interface CoreAccount {
  accountId: string;
  customerId: string;
}

// 取引情報
export interface CoreTransaction {
  transactionId: string;
  accountId: string;
}

// API レスポンス
export interface CoreApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
