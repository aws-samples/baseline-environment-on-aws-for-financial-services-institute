#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OnlineBankingAppBackendStack } from '../lib/online-banking-app-backend-stack';
import { OnlineBankingAppFrontendStack } from '../lib/online-banking-app-frontend-stack';
import { CoreBankingSystemStack } from '../lib/temporary-core-banking-system-stack';
// import { MailDeliveryFunctionStack } from '../lib/mail-delivery-function-stack';

// Backend Stackの型定義
interface BackendStackWithEndpoint extends OnlineBankingAppBackendStack {
  readonly apiEndpoint: string;
}

const app = new cdk.App();

// 環境設定 - CDKが自動的にアカウントとリージョンを解決
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1',
};

// 環境変数が設定されていない場合は、CDKに自動解決させる
const resolvedEnv = env.account ? env : undefined;

// デプロイオプション設定
const deployOptions = {
  // コアバンキングシステムをデプロイするかどうか
  // 既存の基幹系システムがある場合は false に設定
  deployCoreSystem: process.env.DEPLOY_CORE_SYSTEM !== 'false', // デフォルトはtrue（サンプル用）

  // オンラインバンキングアプリのバックエンドをデプロイするかどうか
  deployBackend: process.env.DEPLOY_BACKEND !== 'false', // デフォルトはtrue

  // オンラインバンキングアプリのフロントエンドをデプロイするかどうか
  deployFrontend: process.env.DEPLOY_FRONTEND !== 'false', // デフォルトはtrue

  // メール配信基盤をデプロイするかどうか
  // メール機能が不要な場合は false に設定
  deployMailDelivery: process.env.DEPLOY_MAIL_DELIVERY === 'true', // デフォルトはfalse（ph2対応のため）
};

// コアバンキングシステムスタック（オプション）
let coreSystemStack: CoreBankingSystemStack | undefined;
if (deployOptions.deployCoreSystem) {
  coreSystemStack = new CoreBankingSystemStack(app, 'CoreBankingSystemStack', {
    env: resolvedEnv,
    isPrimary: true,
    replicaRegions: [],
    description: 'Core banking system infrastructure (sample implementation)',
  });
}

// オンラインバンキングアプリ バックエンドスタック
let backendStack: BackendStackWithEndpoint | undefined;
if (deployOptions.deployBackend) {
  backendStack = new OnlineBankingAppBackendStack(app, 'OnlineBankingAppBackendStack', {
    env: resolvedEnv,
    isPrimary: true,
    replicaRegions: [],
    description: 'Online banking application backend infrastructure',
    // ===== Core Banking System連携設定 =====
    // 注意: 実際の既存の勘定系システムと接続時は、現状に合わせてこれらを修正する必要があります。
    // - coreSystemEndpoint: 既存勘定系のAPIエンドポイントURL
    // - coreSystemApiKeyId: 既存勘定系のAPI Key（使用する場合）
    coreSystemEndpoint:
      coreSystemStack?.coreApiEndpoint ||
      process.env.CORE_API_ENDPOINT ||
      cdk.Fn.importValue('CoreBankingSystemStack-CoreApiEndpoint'),
    coreSystemApiKeyId:
      coreSystemStack?.coreApiKeyId ||
      process.env.CORE_API_KEY_ID ||
      cdk.Fn.importValue('CoreBankingSystemStack-CoreApiKeyId'),
    // Core Banking APIのIDを追加
    coreSystemApiId: coreSystemStack?.coreApiId,
  }) as BackendStackWithEndpoint;

  // コアシステムがデプロイされる場合は依存関係を設定
  if (coreSystemStack) {
    backendStack.addDependency(coreSystemStack);
  }
}

// オンラインバンキングアプリ フロントエンドスタック
if (deployOptions.deployFrontend) {
  const frontendStack = new OnlineBankingAppFrontendStack(app, 'OnlineBankingAppFrontendStack', {
    env: resolvedEnv,
    description: 'Online banking application frontend infrastructure',
    // API エンドポイントとAPI Key値はSSM Parameter Storeから取得
  });

  // 依存関係を設定
  if (backendStack) {
    frontendStack.addDependency(backendStack);
  }
}
