# フロントエンド概要

本プロトタイプのフロントエンドは [React](https://react.dev/) で実装されています。

Amazon Connect のエージェント状態やコンタクトイベントの取得には [AmazonConnectSDK](https://github.com/amazon-connect/AmazonConnectSDK) を利用します。この SDK を利用することで、Agent Workspace 上で 3rd party application として動かす際に Amazon Connect のエージェント状態やコンタクトイベントの取得を行うことができます。

GraphQL Client には [Apollo Client](https://www.apollographql.com/docs/react/) を利用します。GraphQL スキーマから Typescript の型定義を生成したり、クエリを実行するための React hooks コードを生成するために [graphql-codegen](https://the-guild.dev/graphql/codegen) を利用しています。

アプリケーションの認証には Cognito ユーザープールが使われています。フロントエンドの認証画面の実装は、[AWS Amplify ライブラリ](https://docs.amplify.aws/react/)と、[Amplify UI ライブラリ](https://ui.docs.amplify.aws/)利用して行っています。

## 画面

### Agent Workspace 上で 3rd party application として起動した場合

<img src="../docs/images/screen_integrated.png" width="800" />

### 単体で起動した場合

Agent Workspace 上ではなく、アプリケーションを単体で起動する場合は、エージェントの履歴やコンタクトイベントを取得し監視を自動で開始することができません。ただし、コンタクト ID を画面上部の Contact ID フィールドに入力して Start Monitor ボタンを押すことで、手動で監視を開始することができます。

<img src="../docs/images/screen_app.png" width="800" />

## ディレクトリ構成

```
connect-call-monitoring/frontend/
├── src
│   ├── components
│   │   ├── ui                               # shadcn/ui のプリミティブコンポーネント
│   │   ├── Ccp.tsx                          # Custom CCP 化用のコンポーネント（オプショナル）
│   │   ├── ConfirmationButton.tsx           # 確認ダイアログボタンコンポーネント
│   │   ├── HeaderMenuButton.tsx             # ヘッダーメニューボタンコンポーネント
│   │   └── LanguageButton.tsx               # 言語切り替えボタンコンポーネント
│   ├── graphql
│   │   ├── generated.ts                     # codegen で生成した GraphQL 型定義と オペレーションの React Hooks
│   │   └── operation.graphql                # codegen で利用する GraphQL オペレーション（query, mutation, subscription）が書かれたドキュメント
│   ├── i18n                                 # 多言語対応リソースのディレクトリ
│   │   ├── en.json                          # 英語リソースファイル
│   │   └── ja.json                          # 日本語リソースファイル
│   ├── pages
│   │   ├── MainPage.tsx                     # メインページ
│   │   └── SettingsPage.tsx                 # Bot 設定ページ
│   ├── providers
│   │   ├── ApolloClientProvider.tsx         # GraphQL Client (Apollo Client) プロバイダー
│   │   └── ConnectProvider.tsx              # Amazon Connect のエージェント状態やコンタクトイベントを管理するプロバイダー
│   ├── stores
│   │   ├── BotStore.tsx                     # Bot のステートストア、また Bot 関連の関数を提供するプロバイダー
│   │   ├── ContactDetailStore.tsx           # コンタクト関連のストア、また文字起こしやコンプライアンスチェック等の関数を提供するプロバイダー
│   │   ├── ContactStore.tsx                 # エージェントに紐づくコンタクト履歴のストア
│   │   ├── useBotReducer.ts                 # BotStore 用のステート更新アクション
│   │   ├── useContactDetailReducer.ts       # ContactDetailStore 用のステート更新アクション
│   │   └── useContactReducer.ts             # ContactStore 用のステート更新アクション
│   ├── App.tsx                              # 各ページの基礎となるコンポーネント
│   └── main.tsx                             # index.html で一番最初に読み込まれる、メインとなるコンポーネント
├── .env.development.local.template          # ローカル開発時に利用する環境変数のテンプレート
├── codegen.yaml                             # codegen 設定ファイル
├── index.html
├── package-lock.json
└── package.json
```

## ローカル開発

フロントエンドのデバッグや開発は、ローカルで起動してホットリロード機能を用いることで、開発の効率が上がります。ここでは、ローカルでのフロントエンド起動方法について説明します。

[.env.development.local.template](.env.development.local.template) を元に `.env.development.local` ファイルを作成し、ローカル開発時に必要な環境変数をセットします。必要な値はデプロイ後に Outputs: としてコンソールに表示されます。
値は [CloudFormation のコンソール](https://console.aws.amazon.com/cloudformation)からも確認できます。「CallMonitorAppStack」を選択いただき、「出力」タブの内容をご確認ください。

```bash
# Coginito ユーザープール ID
VITE_USERPOOL_ID="ap-northeast-1_xxx"
# Coginito ユーザープールクライアント ID
VITE_USERPOOL_CLIENT_ID="xxx"
# AppSync GraphQL API エンドポイント URL
VITE_APPSYNC_API="https://xxx.appsync-api.ap-northeast-1.amazonaws.com/graphql"
# アプリケーションがデプロイされるリージョン
VITE_REGION="ap-northeast-1"
# Amazon Connect インスタンスの URL
VITE_CONNECT_URL="https://xxx.my.connect.aws"
```

`.env.development.local`ファイルを作成後、以下のコマンドでフロントエンドを起動できます。

```bash
npm ci
npm run dev
```

[http://localhost:5173/](http://localhost:5173/) にアクセスし、UI が表示されることを確認します。

**注意** Agent Workspace と連携する部分のテストを行いたい場合は、コードを変更した後にデプロイしていただき、Agent Workspace で開いて連携を確認する必要があります。ローカルで起動する方法では Agent Workspace と連携することはできないのでご注意ください。

## GraphQL API の呼び出しについて

フロントエンドでの GraphQL API の呼び出し方について、法令違反チェックを行う API の呼び出し方を例に説明します。

GraphQL の [スキーマファイル](../cdk/graphql/schema.graphql)にある下記の `checkTranscript` mutation は、フロントエンドから呼び出される法令違反チェックを行う API です。

```
type Mutation @aws_cognito_user_pools @aws_iam {
  checkTranscript(input: CheckTranscriptInput!): Contact
}

input CheckTranscriptInput {
  contactId: ID!
}

type Contact @aws_cognito_user_pools @aws_iam {
  PK: ID!
  SK: String!
  contactId: ID!
  startDate: String
  endDate: String
  createdAt: String!
  summary: String
  checkResult: String
  cost: Float
  type: String!
}
```

この API を呼び出すオペレーションは、`frontend` ディレクトリ下の [operation.graphql](./src/graphql/operation.graphql) で管理されています。例えば、`checkTranscript` を呼び出すオペレーションは下記のように書かれています。

```
mutation checkTranscript($input: CheckTranscriptInput!) {
  checkTranscript(input: $input) {
    contactId
    checkResult
    startDate
    endDate
  }
}
```

レスポンスには、`contactId`、`checkResult`, `startDate`, `endDate` が含まれることがわかります。

このレスポンスに、スキーマのレスポンスで定義されている `cost` を含めたいとします。

まず、`endDate` の下に `cost` を追加します。

```
mutation checkTranscript($input: CheckTranscriptInput!) {
  checkTranscript(input: $input) {
    contactId
    checkResult
    startDate
    endDate
    cost
  }
}
```

次に、オペレーションの hooks を更新します。本アプリケーションでは、上記のオペレーションを React hooks に変換するために [graphql-codegen](https://the-guild.dev/graphql/codegen) を利用しています。クエリを書かずに API 呼び出しを行うことができるため、ソースコードの記述が減り、読みやすくなります。

下記は codegen で作成された checkTranscript の hooks を呼び出しているコードです。[ContactDetailStore.tsx Ln.70](./src/stores/ContactDetailStore.tsx#L70) にあります。

```typescript
const [_checkTranscript, { data: checkResult, error: checkResultError }] = useCheckTranscriptMutation();
```

`_checkTranscript` が API を呼び出すための関数、`checkResult` がレスポンスです。

この hooks の中身を更新するために、codegen を実行する必要があります。下記のコマンドを実行します。

```bash
cd frontend
npm run codegen
```

この操作により、[generated.ts](./src/graphql/generated.ts) ファイルが更新され、`useCheckTranscriptMutation` hooks がアップデートされます。`checkResult` に cost が含まれて渡ってくるようになります。

スキーマファイルの更新がありオペレーションを更新する場合は、上記のステップでオペレーションファイルの更新と codegen 実行を実施してください。

## 参考：カスタムコンタクトコントロールパネルを埋め込む (Custom CCP)

本プロトタイプは Agent Workspace 上の 3rd party application として実装されていますが、Amazon Connect と連携するアプリケーションを実装するもう一つの方法として、[カスタムコンタクトコントロールパネルを埋め込む方法](https://docs.aws.amazon.com/ja_jp/connect/latest/adminguide/embed-custom-ccp.html)があります。アプリケーションを Agent Workspace に埋め込まず、単体のアプリケーションとして利用したい場合はこちらの方法を検討することができます。

本プロトタイプには、オプショナルな実装として、カスタムコントロールパネルを埋め込むためのサンプルコードが含まれています。下記の手順でコードを編集することで、アプリケーションをカスタムコントロールパネル化することが可能です。

### 1. App.tsx を編集する

[App.tsx](./src/App.tsx) の 14 行目と 64 ~ 68 行目のコメントを外し、Ccp コンポーネントを利用可能にしてください。

```javascript
import Ccp from '@/components/Ccp';
~
const Softphone = useCallback(() => {
  return (
    <div className="h-[calc(100vh-53px)] w-96 bg-[#f2f2f2] px-4 py-2">
      <Ccp />
    </div>
  );
}, []);
```

### 2. ConnectProvider.tsx を編集する

[ConnectProvider.tsx](./src/providers/ConnectProvider.tsx) の 63 行目から 158 行目までコメントアウトしてください。

```javascript
  // 以降を全てコメントアウトしてください

  const agentClient = new AgentClient();
  const contactClient = new ContactClient();
  ...
  const initContactId = async (id: string): Promise<void> => {
    ...
    if (orgContactId && orgContactId !== id) {
      setOriginalContactId(orgContactId);
      // originalContactId を優先して Live Transcription 対象のコールIDに設定する
      setContactId(orgContactId);
    } else {
      setContactId(id);
    }
    return;
  };

```

また、不要となるインポートライブラリもコメントアウトするか、削除してください。

削除後

```javascript
import React, { ReactNode, createContext, useState } from 'react';
import { AgentStateChanged } from '@amazon-connect/contact';
```

### 3. デプロイ

[cdk.json](../cdk/cdk.json) を開き、`connectUrl` に Amazon Connect インスタンスの URL を入力します。

```
"connectUrl": "https://xxx.my.connect.aws",
```

デプロイを実行します。

```bash
npx cdk deploy --all --require-approval never
```

### 4. 承認済みオリジンの設定

デプロイ後、AWS コンソール画面で Amazon Connect のインスタンスを開き、左メニューから [Applications] > [承認済みオリジン] を開いてください。

アプリケーションの URL を承認済みドメインとして登録します。アプリケーションの URL は、デプロイ後に Outputs: としてコンソールに表示される `https://xxx.cloudfront.net` という形式の値です。

### 5. 動作確認

アプリケーションの URL にアクセスすると、コントロールパネルのログインポップアップが表示されます。

Amazon Connect ユーザーでログインしてください。

<img src="../docs/images/screen_ccp_login_popup.png" width="300px" />

ポップアップがブロックされていると表示されません。ポップアップを許可し、画面を再読み込みしてください。

<img src="../docs/images/screen_allow_popup.png" width="300px" />

アプリケーション画面左部に、ソフトフォンの UI が埋め込まれているのを確認してください。

通話を開始すると、自動で文字起こしとコンプライアンスチェックが開始されることを確認してください。

<img src="../docs/images/screen_customccp.png" width="800px" />
