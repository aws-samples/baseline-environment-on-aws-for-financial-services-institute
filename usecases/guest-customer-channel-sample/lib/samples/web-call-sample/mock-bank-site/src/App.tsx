import type { FC } from 'react';
import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import AccountSummary from './components/AccountSummary';
import QuickActions from './components/QuickActions';
import TransactionHistory from './components/TransactionHistory';
import Footer from './components/Footer';
import { serviceConfigs } from './config/serviceConfig';

const App: FC = () => {
  const [selectedService, setSelectedService] = useState('銀行');
  const config = serviceConfigs[selectedService];

  useEffect(() => {
    document.title = `${config.companyName} - オンライン${config.name}`;
  }, [config.companyName, config.name]);

  return (
    <div className="app" style={{ '--theme-color': config.themeColor } as React.CSSProperties}>
      <Header selectedService={selectedService} onServiceChange={setSelectedService} />
      <main className="main-content">
        <div className="welcome-banner">
          <h1>{config.welcomeMessage}</h1>
          <p>最終ログイン: 2025年5月15日 14:30</p>
        </div>
        <AccountSummary config={config} />
        <QuickActions config={config} />
        <TransactionHistory config={config} />
      </main>
      <Footer config={config} selectedService={selectedService} onServiceChange={setSelectedService} />
    </div>
  );
};

export default App;
