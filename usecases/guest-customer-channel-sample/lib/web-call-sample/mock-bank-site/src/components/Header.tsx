import type { FC } from 'react';
import '../styles/Header.css';

const Header: FC = () => {
  return (
    <header className="header">
      <div className="logo-container">
        <div className="logo">AnyBank</div>
      </div>
      <nav className="nav">
        <ul>
          <li>ホーム</li>
          <li>残高照会</li>
          <li>振込・送金</li>
          <li>定期預金</li>
          <li>ローン</li>
          <li>お問い合わせ</li>
        </ul>
      </nav>
      <div className="user-info">
        <span className="user-name">山田 太郎</span>
        <button className="logout-button">ログアウト</button>
      </div>
    </header>
  );
};

export default Header;
