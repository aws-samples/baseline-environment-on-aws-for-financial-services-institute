import type { FC } from 'react';
import '../styles/Footer.css';

const Footer: FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>AnyBank</h3>
          <p>〒100-0001</p>
          <p>東京都千代田区1-1-1</p>
          <p>エニータワー</p>
        </div>
        <div className="footer-section">
          <h3>リンク</h3>
          <ul>
            <li>ホーム</li>
            <li>サービス一覧</li>
            <li>金利情報</li>
            <li>店舗・ATM</li>
          </ul>
        </div>
        <div className="footer-section">
          <h3>サポート</h3>
          <ul>
            <li>よくある質問</li>
            <li>お問い合わせ</li>
            <li>セキュリティ</li>
            <li>利用規約</li>
          </ul>
        </div>
        <div className="footer-section">
          <h3>お問い合わせ</h3>
          <p>電話: 0120-XXX-XXX</p>
          <p>（平日 9:00-17:00）</p>
          <p>メール: info@any-bank.example.com</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2025 AnyBank. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
