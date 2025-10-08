import type { FC } from 'react';
import '../styles/Footer.css';
import type { ServiceConfig } from '../config/serviceConfig';

interface FooterProps {
  config: ServiceConfig;
  selectedService: string;
  onServiceChange: (service: string) => void;
}

const Footer: FC<FooterProps> = ({ config, selectedService, onServiceChange }) => {
  const services = ['銀行', '証券', '損害保険', '生命保険'];

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>{config.companyName}</h3>
          <p>〒100-0001</p>
          <p>東京都千代田区1-1-1</p>
          <p>エニータワー</p>
          <select
            className="footer-service-selector"
            value={selectedService}
            onChange={(e) => onServiceChange(e.target.value)}
          >
            {services.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>
        {config.footerSections.map((section, index) => (
          <div key={index} className="footer-section">
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
        <div className="footer-section">
          <h3>お問い合わせ</h3>
          <p>電話: 0120-XXX-XXX</p>
          <p>（平日 9:00-17:00）</p>
          <p>メール: info@{config.companyName.toLowerCase()}.example.com</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2025 {config.companyName}. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
