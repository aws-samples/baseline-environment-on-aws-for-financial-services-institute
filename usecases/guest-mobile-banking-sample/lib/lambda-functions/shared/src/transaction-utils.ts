// 取引関連のユーティリティ関数

// 取引種別に応じた表示名を取得
export function getTransactionDescription(type: string): string {
  switch (type) {
    case 'TRANSFER_DEPOSIT':
      return '振込入金';
    case 'TRANSFER_WITHDRAWAL':
      return '振込出金';
    case 'ATM_DEPOSIT':
      return 'ATM入金';
    case 'ATM_WITHDRAWAL':
      return 'ATM出金';
    default:
      return type.includes('DEPOSIT') ? '入金' : '出金';
  }
}

// 取引種別に応じたカテゴリを取得
export function getTransactionCategory(type: string): string {
  switch (type) {
    case 'TRANSFER_DEPOSIT':
    case 'TRANSFER_WITHDRAWAL':
      return 'transfer';
    case 'ATM_DEPOSIT':
    case 'ATM_WITHDRAWAL':
      return 'atm';
    default:
      return 'other';
  }
}

// 取引種別に応じたアイコンを取得
export function getTransactionIcon(type: string): string {
  switch (type) {
    case 'TRANSFER_DEPOSIT':
    case 'TRANSFER_WITHDRAWAL':
      return '💸';
    case 'ATM_DEPOSIT':
    case 'ATM_WITHDRAWAL':
      return '🏧';
    default:
      return type.includes('DEPOSIT') ? '⬇️' : '⬆️';
  }
}

// 取引データを処理
export function processTransaction(tx: any) {
  return {
    transactionId: tx.transactionId,
    timestamp: tx.timestamp,
    type: tx.type,
    amount: tx.amount,
    status: tx.status,
    description: tx.description || getTransactionDescription(tx.type),
    category: getTransactionCategory(tx.type),
    icon: getTransactionIcon(tx.type),
    ...(tx.sourceAccountId && { sourceInfo: `送金元: ${tx.sourceAccountId}` }),
    ...(tx.targetAccountId && { targetInfo: `送金先: ${tx.targetAccountId}` }),
    ...(tx.transferId && { transferId: tx.transferId }),
  };
}
