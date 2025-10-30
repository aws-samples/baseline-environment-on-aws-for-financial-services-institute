import type { FC } from 'react';
import { useState } from 'react';
import '../styles/Header.css';
import { serviceConfigs } from '../config/serviceConfig';

interface HeaderProps {
  selectedService: string;
  onServiceChange: (service: string) => void;
}

const Header: FC<HeaderProps> = ({ selectedService }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const config = serviceConfigs[selectedService];

  return (
    <header className="header">
      <div className="logo-container">
        <div className="logo">{config.companyName}</div>
      </div>
      <button className="mobile-menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="メニューを開く">
        ☰
      </button>
      <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
        <ul>
          {config.menuItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
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
