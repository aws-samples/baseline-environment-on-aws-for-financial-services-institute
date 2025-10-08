import type { FC } from 'react';
import '../styles/AccountSummary.css';
import type { ServiceConfig } from '../config/serviceConfig';

interface AccountSummaryProps {
  config: ServiceConfig;
}

const AccountSummary: FC<AccountSummaryProps> = ({ config }) => {
  return (
    <div className="account-summary">
      <h2>{config.sectionTitle}</h2>
      <div className="account-cards">
        {config.accounts.map((account, index) => (
          <div key={index} className="account-card">
            <h3>{account.name}</h3>
            <p className="account-number">
              {config.numberLabel}: {account.number}
            </p>
            <p className="account-balance">残高: {account.balance}</p>
            <div className="account-actions">
              {account.actions.map((action, i) => (
                <button key={i}>{action}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountSummary;
