export interface ServiceConfig {
  name: string;
  companyName: string;
  welcomeMessage: string;
  menuItems: string[];
  themeColor: string;
  sectionTitle: string;
  numberLabel: string;
  footerSections: Array<{
    title: string;
    items: string[];
  }>;
  accounts: Array<{
    name: string;
    number: string;
    balance: string;
    actions: string[];
  }>;
  quickActions: Array<{
    icon: string;
    text: string;
  }>;
  transactions: Array<{
    date: string;
    description: string;
    amount: string;
    type: 'positive' | 'negative';
  }>;
}

export const serviceConfigs: Record<string, ServiceConfig> = {
  銀行: {
    name: '銀行',
    companyName: 'AnyBank',
    welcomeMessage: 'こんにちは、山田 太郎さん',
    menuItems: ['ホーム', '残高照会', '振込・送金', '定期預金', 'ローン', 'お問い合わせ'],
    themeColor: '#0056b3',
    sectionTitle: '口座概要',
    numberLabel: '口座番号',
    footerSections: [
      { title: 'サービス', items: ['インターネットバンキング', 'モバイルアプリ', 'ATMサービス', 'ローン相談'] },
      { title: 'サポート', items: ['よくある質問', 'お問い合わせ', '手数料一覧', 'セキュリティ'] },
      { title: '会社情報', items: ['会社概要', 'ニュース', '採用情報', '投資家情報'] },
    ],
    accounts: [
      { name: '普通預金', number: '****-1234', balance: '¥1,234,567', actions: ['振込', '明細'] },
      { name: '定期預金', number: '****-5678', balance: '¥5,000,000', actions: ['解約', '明細'] },
    ],
    quickActions: [
      { icon: '💸', text: '振込・送金' },
      { icon: '📊', text: '残高照会' },
      { icon: '💰', text: '定期預金' },
      { icon: '🏠', text: 'ローン' },
    ],
    transactions: [
      { date: '2025-01-15', description: 'ATM出金', amount: '-¥10,000', type: 'negative' },
      { date: '2025-01-14', description: '給与振込', amount: '+¥300,000', type: 'positive' },
      { date: '2025-01-13', description: '電気料金', amount: '-¥8,500', type: 'negative' },
    ],
  },
  証券: {
    name: '証券',
    companyName: 'AnySecurities',
    welcomeMessage: 'こんにちは、山田 太郎さん',
    menuItems: ['ホーム', '株式売買', '投資信託', 'ポートフォリオ', '市況情報', 'お問い合わせ'],
    themeColor: '#d32f2f',
    sectionTitle: '口座概要',
    numberLabel: '口座番号',
    footerSections: [
      { title: 'サービス', items: ['オンライン取引', 'モバイルアプリ', '市況情報', '投資相談'] },
      { title: 'サポート', items: ['よくある質問', 'お問い合わせ', '手数料一覧', 'リスク情報'] },
      { title: '会社情報', items: ['会社概要', 'ニュース', '採用情報', '投資家情報'] },
    ],
    accounts: [
      { name: '総合口座', number: '****-9876', balance: '¥2,345,678', actions: ['売買', '明細'] },
      { name: 'NISA口座', number: '****-5432', balance: '¥800,000', actions: ['買付', '明細'] },
    ],
    quickActions: [
      { icon: '📈', text: '株式売買' },
      { icon: '💹', text: '投資信託' },
      { icon: '📊', text: 'ポートフォリオ' },
      { icon: '📰', text: '市況情報' },
    ],
    transactions: [
      { date: '2025-01-15', description: 'ABC株式会社 売却', amount: '+¥150,000', type: 'positive' },
      { date: '2025-01-14', description: '投資信託 買付', amount: '-¥50,000', type: 'negative' },
      { date: '2025-01-13', description: '配当金受取', amount: '+¥12,000', type: 'positive' },
    ],
  },
  損害保険: {
    name: '損害保険',
    companyName: 'AnyInsurance',
    welcomeMessage: 'こんにちは、山田 太郎さん',
    menuItems: ['ホーム', '自動車保険', '火災保険', '事故受付', 'ロードサービス', 'お問い合わせ'],
    themeColor: '#388e3c',
    sectionTitle: '契約概要',
    numberLabel: '証券番号',
    footerSections: [
      { title: 'サービス', items: ['オンライン手続き', 'モバイルアプリ', '事故受付', 'ロードサービス'] },
      { title: 'サポート', items: ['よくある質問', 'お問い合わせ', '保険料試算', '給付金請求'] },
      { title: '会社情報', items: ['会社概要', 'ニュース', '採用情報', 'ディスクロージャー'] },
    ],
    accounts: [
      { name: '自動車保険', number: 'AUTO-1234', balance: '年額¥120,000', actions: ['更新', '変更'] },
      { name: '火災保険', number: 'FIRE-5678', balance: '年額¥45,000', actions: ['更新', '変更'] },
    ],
    quickActions: [
      { icon: '🚗', text: '自動車保険' },
      { icon: '🏠', text: '火災保険' },
      { icon: '📋', text: '事故受付' },
      { icon: '📞', text: 'ロードサービス' },
    ],
    transactions: [
      { date: '2025-01-15', description: '自動車保険料', amount: '-¥10,000', type: 'negative' },
      { date: '2024-12-15', description: '事故保険金', amount: '+¥200,000', type: 'positive' },
      { date: '2024-11-15', description: '火災保険料', amount: '-¥3,750', type: 'negative' },
    ],
  },
  生命保険: {
    name: '生命保険',
    companyName: 'AnyLife',
    welcomeMessage: 'こんにちは、山田 太郎さん',
    menuItems: ['ホーム', '生命保険', '医療保険', '給付金請求', '健康相談', 'お問い合わせ'],
    themeColor: '#7b1fa2',
    sectionTitle: '契約概要',
    numberLabel: '証券番号',
    footerSections: [
      { title: 'サービス', items: ['オンライン手続き', 'モバイルアプリ', '給付金請求', '健康相談'] },
      { title: 'サポート', items: ['よくある質問', 'お問い合わせ', '保険料試算', '給付手続き'] },
      { title: '会社情報', items: ['会社概要', 'ニュース', '採用情報', 'ディスクロージャー'] },
    ],
    accounts: [
      { name: '終身保険', number: 'LIFE-1234', balance: '保険金額¥10,000,000', actions: ['変更', '明細'] },
      { name: '医療保険', number: 'MED-5678', balance: '日額¥10,000', actions: ['変更', '明細'] },
    ],
    quickActions: [
      { icon: '👨‍👩‍👧‍👦', text: '生命保険' },
      { icon: '🏥', text: '医療保険' },
      { icon: '📋', text: '給付金請求' },
      { icon: '📞', text: '健康相談' },
    ],
    transactions: [
      { date: '2025-01-15', description: '生命保険料', amount: '-¥25,000', type: 'negative' },
      { date: '2024-12-20', description: '入院給付金', amount: '+¥100,000', type: 'positive' },
      { date: '2024-12-15', description: '医療保険料', amount: '-¥8,000', type: 'negative' },
    ],
  },
};
