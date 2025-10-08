import { EventBridgeEvent } from 'aws-lambda';
import { CoreApiClient, SimpleHttpClient } from '@online-banking/shared';

const CORE_API_BASE_URL = (process.env.CORE_API_BASE_URL || '').replace(/\/+$/, '');
const MAIL_DELIVERY_API = (process.env.MAIL_DELIVERY_API || '').replace(/\/+$/, '');

// Core Banking APIクライアント
const coreApiClient = new CoreApiClient();

// Mail Delivery APIクライアント（Mail Delivery APIはIAM認証を維持）
const mailDeliveryClient = new SimpleHttpClient();

interface TransferCompletedEvent {
  transactionId: string;
  sourceAccountId: string;
  targetAccountId: string;
  amount: number;
  completedAt: string;
  aggregateId: string;
  version: number;
}

export const handler = async (event: EventBridgeEvent<'TransferCompleted', TransferCompletedEvent>) => {
  console.log('Transfer completion notification event received:', JSON.stringify(event, null, 2));

  try {
    const { transactionId, sourceAccountId, targetAccountId, amount, completedAt } = event.detail;

    // 1. Core Banking APIから振込元口座情報を取得
    console.log('📤 Fetching source account info:', { sourceAccountId });

    const sourceAccount = await coreApiClient.getAccountInfo(sourceAccountId);

    if (!sourceAccount || !sourceAccount.customerId) {
      console.error('❌ Source account not found or customerId missing:', { sourceAccountId });
      return;
    }

    // 2. 顧客情報を取得
    console.log('📤 Fetching customer info:', { customerId: sourceAccount.customerId });

    const sourceCustomer = await coreApiClient.getCustomerInfo(sourceAccount.customerId);

    if (!sourceCustomer || !sourceCustomer.email) {
      console.error('❌ Source customer not found or email missing:', { sourceAccountId });
      return;
    }

    // 3. メール内容を構築（Mail Delivery API仕様に合わせる）
    const emailData = {
      recipients: [
        {
          email: sourceCustomer.email,
          name: sourceCustomer.name || 'お客様',
          type: 'to',
        },
      ],
      subject: '【サンプル銀行】振込完了のお知らせ',
      body: `${sourceCustomer.name || 'お客様'} 様

サンプル銀行をご利用いただきありがとうございます。
振込処理が完了しました。

【振込内容】
振込金額: ${new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
      }).format(amount)}
振込先口座: ${targetAccountId}
取引ID: ${transactionId}
完了日時: ${new Date(completedAt).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo',
      })}

今後ともサンプル銀行をよろしくお願いいたします。

サンプル銀行 リファレンスアーキ支店`,
      sender: {
        email: 'noreply@aws-bank.com',
        name: 'サンプル銀行',
      },
      priority: 'normal',
      tags: ['transfer', 'completion'],
    };

    console.log('📧 Sending transfer completion email:', {
      to: sourceCustomer.email,
      transactionId: transactionId,
      amount: amount,
    });

    // 4. Mail Delivery APIでメール送信
    console.log('📤 Sending email to Mail Delivery API:', {
      url: `${MAIL_DELIVERY_API}/emails`,
      recipients: emailData.recipients.map((r) => r.email),
      subject: emailData.subject,
    });

    // メール配信処理
    console.log(
      '📧 メール配信基盤はこのサンプルアーキテクチャの対象外ですが、このLambdaから呼び出す形を想定して設計しています',
    );
    console.log('📧 実装時は以下のような外部API呼び出しを行います:', {
      recipient: sourceCustomer.email,
      subject: emailData.subject,
      template: 'transfer-completion',
      transactionId: transactionId,
    });

    console.log('✅ Transfer completion notification processed:', {
      transactionId: transactionId,
      recipient: sourceCustomer.email,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('❌ Failed to send transfer completion email:', {
      transactionId: event.detail.transactionId,
      error: errorMessage,
      errorStack: errorStack,
      mailDeliveryApi: MAIL_DELIVERY_API,
      mailDeliveryApiKey: process.env.MAIL_DELIVERY_API_KEY ? '[SET]' : '[NOT SET]',
      coreApiBaseUrl: CORE_API_BASE_URL,
      timestamp: new Date().toISOString(),
    });

    // メール送信失敗は振込処理に影響させない
    // ただし、CloudWatchでアラートを発生させるためにエラーログを出力
  }
};
