import type { FC } from 'react';
import './App.css';
import Header from './components/Header';
import AccountSummary from './components/AccountSummary';
import QuickActions from './components/QuickActions';
import TransactionHistory from './components/TransactionHistory';
import Footer from './components/Footer';

const App: FC = () => {
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <div className="welcome-banner">
          <h1>こんにちは、山田 太郎さん</h1>
          <p>最終ログイン: 2025年5月15日 14:30</p>
        </div>
        <AccountSummary />
        <QuickActions />
        <TransactionHistory />
      </main>
      <Footer />
    </div>
  );
};

export default App;
