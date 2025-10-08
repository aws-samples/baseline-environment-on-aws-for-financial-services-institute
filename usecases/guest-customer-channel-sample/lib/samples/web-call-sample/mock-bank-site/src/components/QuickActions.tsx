import type { FC } from 'react';
import '../styles/QuickActions.css';
import type { ServiceConfig } from '../config/serviceConfig';

interface QuickActionsProps {
  config: ServiceConfig;
}

const QuickActions: FC<QuickActionsProps> = ({ config }) => {
  return (
    <div className="quick-actions">
      <h2>クイックアクション</h2>
      <div className="action-buttons">
        {config.quickActions.map((action, index) => (
          <button key={index} className="action-button">
            <div className="action-icon">{action.icon}</div>
            <div className="action-text">{action.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
