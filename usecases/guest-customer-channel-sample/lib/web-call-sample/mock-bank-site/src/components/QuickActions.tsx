import type { FC } from 'react';
import '../styles/QuickActions.css';

const QuickActions: FC = () => {
  return (
    <div className="quick-actions">
      <h2>クイックアクション</h2>
      <div className="action-buttons">
        <button className="action-button">
          <div className="action-icon">💸</div>
          <div className="action-text">振込</div>
        </button>
        <button className="action-button">
          <div className="action-icon">🔄</div>
          <div className="action-text">口座間振替</div>
        </button>
        <button className="action-button">
          <div className="action-icon">📊</div>
          <div className="action-text">残高照会</div>
        </button>
        <button className="action-button">
          <div className="action-icon">📝</div>
          <div className="action-text">定期預金</div>
        </button>
        <button className="action-button">
          <div className="action-icon">💳</div>
          <div className="action-text">カード管理</div>
        </button>
        <button className="action-button">
          <div className="action-icon">🔔</div>
          <div className="action-text">通知設定</div>
        </button>
      </div>
    </div>
  );
};

export default QuickActions;
