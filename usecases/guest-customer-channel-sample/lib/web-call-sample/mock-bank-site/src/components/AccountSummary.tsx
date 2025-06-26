import type { FC } from 'react';
import '../styles/AccountSummary.css';

const AccountSummary: FC = () => {
  return (
    <div className="account-summary">
      <h2>口座概要</h2>
      <div className="account-cards">
        <div className="account-card">
          <h3>普通預金</h3>
          <p className="account-number">口座番号: 1234567</p>
          <p className="account-balance">残高: ¥1,250,000</p>
          <div className="account-actions">
            <button>入出金明細</button>
            <button>振込</button>
          </div>
        </div>
        <div className="account-card">
          <h3>定期預金</h3>
          <p className="account-number">口座番号: 7654321</p>
          <p className="account-balance">残高: ¥3,500,000</p>
          <div className="account-actions">
            <button>明細確認</button>
            <button>新規預入</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSummary;
