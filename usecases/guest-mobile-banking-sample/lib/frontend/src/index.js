import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { store } from './store/store';
import theme from './theme';

// アプリケーション初期化関数
async function initializeApp() {
  try {
    // config.jsonを読み込み
    const response = await fetch('/config.json');
    const config = await response.json();

    console.log('Loaded config:', config);

    // グローバル設定として保存
    window.APP_CONFIG = {
      BANKING_API: config.REACT_APP_BANKING_API,
      API_KEYS: {
        CUSTOMER: config.REACT_APP_CUSTOMER_API_KEY || '',
        ADMIN: config.REACT_APP_ADMIN_API_KEY || '',
        AUTH: config.REACT_APP_AUTH_API_KEY || '',
      },
    };

    console.log('Final APP_CONFIG:', window.APP_CONFIG);
  } catch (error) {
    console.error('Failed to load config.json, using fallback configuration:', error);

    // フォールバック設定
    window.APP_CONFIG = {
      BANKING_API: 'https://api.example.com/v1/',
      API_KEYS: {
        CUSTOMER: '',
        ADMIN: '',
        AUTH: '',
      },
    };
  }

  // 設定読み込み完了を通知
  window.APP_CONFIG_READY = Promise.resolve();

  // Reactアプリを動的インポートして起動
  const { default: App } = await import('./App');

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </BrowserRouter>
      </Provider>
    </React.StrictMode>,
  );
}

// アプリケーション初期化を実行
initializeApp().catch((error) => {
  console.error('Failed to initialize application:', error);
});
