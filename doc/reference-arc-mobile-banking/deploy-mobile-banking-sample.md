# [モバイルバンキング] ワークロード サンプルコードのデプロイ手順

[リポジトリの README に戻る](../../README.md)

## 導入手順

ゲストアカウントにデプロイする手順を示します。

### 1. ゲストアカウントデプロイ用の AWS CLI プロファイルを設定する

ゲストアカウントにデプロイするための AWS CLI プロファイルを設定します。ここではゲストアカウントの ID を 123456789012 としています。
~/.aws/config

```sh
# for Guest Account Login
[profile ct-guest-sso]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start/
sso_region = ap-northeast-1
sso_account_id = 123456789012
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1
```

### 2. プロジェクトディレクトリに移動

```sh
cd usecases/guest-mobile-banking-sample
```

### 3. 依存関係のインストールとビルド

```sh
npm install
```

```sh
npm run build
```

### 4. モバイルバンキングワークロードをデプロイする

（ログインしていない場合）AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

ゲストアカウントで CDK ブートストラップを実行します。

```sh
npm run bootstrap
```

### 5. デプロイ方法の選択

モバイルバンキングワークロードには三つの CDK Stack が存在します。

- `CoreBankingSystemStack`: コアバンキングシステム(口座管理、取引処理、顧客管理)
- `OnlineBankingAppBackendStack`: オンラインバンキングアプリのバックエンド(認証、セッション管理、CoreBankingSystem との連携)
- `OnlineBankingAppFrontendStack`: Web アプリケーションフロントエンド

以下のコマンドで全てデプロイされます。

```sh
npm run deploy
```

必要に応じて、個別のスタックのみをデプロイすることも可能です：

```sh
# バックエンドのみデプロイ
npx cdk deploy OnlineBankingAppBackendStack

# フロントエンドのみデプロイ
npx cdk deploy OnlineBankingAppFrontendStack

# コアシステムのみデプロイ
npx cdk deploy TemporarCoreBankingSystemStack
```

デプロイオプションは bin/app.ts で環境変数により制御されています：

```js
// デプロイオプション設定
const deployOptions = {
  // コアバンキングシステムをデプロイするかどうか
  // 既存の基幹系システムがある場合は false に設定
  deployCoreSystem: process.env.DEPLOY_CORE_SYSTEM !== 'false', // デフォルトはtrue（サンプル用）

  // オンラインバンキングアプリのバックエンドをデプロイするかどうか
  deployBackend: process.env.DEPLOY_BACKEND !== 'false', // デフォルトはtrue

  // オンラインバンキングアプリのフロントエンドをデプロイするかどうか
  deployFrontend: process.env.DEPLOY_FRONTEND !== 'false', // デフォルトはtrue
};
```

環境変数を使用して、デプロイするスタックを制御できます：

```sh
# バックエンドのみデプロイ
DEPLOY_FRONTEND=false
DEPLOY_CORE_SYSTEM=false
npm run deploy

# フロントエンドのみデプロイ
DEPLOY_BACKEND=false
DEPLOY_CORE_SYSTEM=false
npm run deploy

# コアバンキングシステム + バックエンドのみデプロイ
DEPLOY_FRONTEND=false
npm run deploy
```

コアバンキングシステム + バックエンドのみデプロイした場合、
lib/frontend/public/config.json に、OutPuts の OnlineBankingAppBackendStack.CoreApiBaseUrl の値を設定してください。
以下のコマンドでローカルでフロントエンドを実行することができます。

```sh
cd lib/frontend
npm start
```

### 3. フロントエンドアプリケーションの確認

デプロイ完了後、CloudFront の URL からフロントエンドアプリケーションにアクセスできます：

1. AWS マネジメントコンソールで CloudFront サービスを開く
2. 作成されたディストリビューションのドメイン名を確認
3. ブラウザでアクセスして[アプリケーションの動作を確認](doc/reference-arc-mobile-banking/guide-mobile-banking-app.md)

## 環境変数の優先順位

コアバンキングシステムのエンドポイントは以下の優先順位で決定されます：

1. **temporary-core-banking-system のエンドポイント**（デプロイされた場合）
2. **環境変数 `CORE_API_BASE_URL`**（本番環境での上書き用）

## 削除手順

サンプルアプリケーションを削除する場合：

```bash
npm run destroy
```

注意：DynamoDB テーブルなど、削除保護が有効なリソースは手動で削除する必要がある場合があります。
