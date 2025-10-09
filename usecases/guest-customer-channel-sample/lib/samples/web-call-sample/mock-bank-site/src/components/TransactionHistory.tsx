import type { FC } from 'react';
import '../styles/TransactionHistory.css';
import type { ServiceConfig } from '../config/serviceConfig';

interface TransactionHistoryProps {
  config: ServiceConfig;
}

const TransactionHistory: FC<TransactionHistoryProps> = ({ config }) => {
  return (
    <div className="transaction-history">
      <h2>最近の取引</h2>
      <table className="transaction-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>内容</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {config.transactions.map((transaction, index) => (
            <tr key={index}>
              <td>{transaction.date}</td>
              <td>{transaction.description}</td>
              <td className={transaction.type}>{transaction.amount}</td>
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
