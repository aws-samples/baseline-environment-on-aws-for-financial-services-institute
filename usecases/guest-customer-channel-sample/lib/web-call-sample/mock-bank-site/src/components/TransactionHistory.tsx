import type { FC } from 'react';
import '../styles/TransactionHistory.css';

// 架空の取引履歴データ（2025年5月までの最近のもの）
const transactions = [
  {
    id: 1,
    date: '2025-05-10',
    description: 'コンビニATM出金',
    amount: -30000,
    balance: 1250000,
  },
  {
    id: 2,
    date: '2025-05-05',
    description: '給与振込 株式会社エニーテック',
    amount: 320000,
    balance: 1280000,
  },
  {
    id: 3,
    date: '2025-04-28',
    description: '家賃引落し',
    amount: -85000,
    balance: 960000,
  },
  {
    id: 4,
    date: '2025-04-25',
    description: '電気料金引落し',
    amount: -12500,
    balance: 1045000,
  },
  {
    id: 5,
    date: '2025-04-20',
    description: 'スーパーマーケット',
    amount: -8500,
    balance: 1057500,
  },
];

const TransactionHistory: FC = () => {
  return (
    <div className="transaction-history">
      <h2>最近の取引</h2>
      <table className="transaction-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>内容</th>
            <th>金額</th>
            <th>残高</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.date}</td>
              <td>{transaction.description}</td>
              <td className={transaction.amount < 0 ? 'negative' : 'positive'}>
                {transaction.amount.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' })}
              </td>
              <td>{transaction.balance.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="transaction-actions">
        <button>もっと見る</button>
        <button>CSVダウンロード</button>
      </div>
    </div>
  );
};

export default TransactionHistory;
