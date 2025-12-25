# CDK 開発規則

このドキュメントは金融リファレンスアーキテクチャプロジェクトにおける CDK 開発の標準規則を定義します。

## プロジェクト構造

### npm サブプロジェクト

- `usecases` ディレクトリ配下にフォルダを作成してサブプロジェクトを作成する
- プロジェクトの構成は既存プロジェクト（`base-ct-guest`）を参考にすること
- `jest.config.js`, `tsconfig.json` は基本はそのままコピーして利用する
- `package.json` は必要な箇所を修正すること
  - `name`
  - `description`
  - `bin`
- `parameter.ts` は必要な箇所を修正すること
  - `context` - `pjPrefix`
  - `dev`, `stage`, `prod` の各環境に必要なパラメータを定義する

### cdk.json コンテキストファイルの定義ルール

- feature flag は明示的に `false` を指定しない場合は省略する（`cdk init` を使うとデフォルトで設定されるので注意）

**省略すべき feature flag の例:**

```json
"@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": false,
"@aws-cdk/core:stackRelativeExports": false,
```

## コーディング規則

### 開発生産性向上

`source-map-support/register` を使用する:

- `bin/` 配下の ts ファイルの先頭で `source-map-support/register` をインポートする

```typescript
import 'source-map-support/register';
```

- `package.json` の `dependencies` ブロックに `"source-map-support"` を追加する

```json
"dependencies": {
  "aws-cdk-lib": "^2.35.0",
  "constructs": "^10.1.70",
  "source-map-support": "^0.5.21"
}
```

### Stack 作成時の命名規則

#### Stack ID（第二引数に設定するユニークな ID）

`parameter.ts` で `PjPrefix` としてプロジェクト固有の識別子（例: `BLEAFSI-Base`）を定義し、application ファイルではこの値をコンテクストファイルから読み取って、リソース名をユニークにするための識別子として使用すること。

**例:**

```typescript
// Unique project prefix
export const PjPrefix = 'BLEAFSI-Base';
// ...
new BLEAFSISecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`);
```

#### Stack のクラス名

クラス名には接頭辞として `BLEAFSI` は不要（大文字 6 文字の接頭辞は長いため、可読性を損なうと判断）。

- ❌ `BLEAFSIIamStack`
- ✅ `IamStack`

### L2/L1 コンストラクトの利用方針

L2 コンストラクトによる CloudFormation テンプレート作成は 1 つのベストプラクティスであり、CDK による開発生産性向上の基本である。

**重要:** L2 コンストラクトがセキュリティ対策を満たしていない場合（例: S3 アクセスログを設定していない、S3 バケットの TLS 強制、Lambda のバージョンが最新版ではない等）でも、L2 コンストラクトから L1 コンストラクトへの書き換えは行わない。

## セキュリティ対策

### VPC/EC2/SecurityGroup

#### 全般

- Route Table を複数の Private Subnet で使い回していない
- Network ACL をデフォルト設定からカスタマイズしていない
- VPC Flow Logs を有効化している
- EBS は暗号化する
- IAM ポリシーには必要最小限の権限のみ設定する
- リソースポリシーが提供されるリソースでは、適切にリソースポリシーによる制限を入れる

#### SecurityGroup の Outbound 制限

SecurityGroup の Outbound をフルオープンにせず、IP やポートを絞り込む:

- IP 制限 または ポート制限（例: 443 のみ）の両方またはどちらかの制限を入れることで、Outbound をデフォルトのフルオープン状態にしない

### S3

#### 全般

- ログ格納用のバケット以外は Access Log を有効化する
- バケットを暗号化する（CMK の利用を推奨）
- VPC からのアクセスには VPC Endpoint (Gateway) を利用する
- リソースポリシーで ALL Deny ポリシーを入れて、IAM ポリシー側での権限制御を無効にするような設定は不要

#### HTTPS 接続の強制（Secure Transport Condition 句）

バケットポリシーに SSL 以外を許可しない condition 句を入れる必要がある。CDK の `enforceSSL` 属性を使用することで 1 行で対応可能。

**例:**

```typescript
const archiveLogsBucket = new s3.Bucket(this, 'ArchiveLogsBucket', {
  accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  enforceSSL: true, // ← ここ
});
```

#### S3 バケットポリシーと IAM ポリシーの使い分け

- **ロールベースのアクセス権限付与**: リソースポリシーと IAM ポリシーのどちらに記述してもよい（リソースポリシーは 20KB の制限あり）
- **AWS サービスからのアクセス**: リソースポリシーに記述（IAM ポリシーでは記載できない）
- **S3 バケットのクロスアカウントアクセス**: リソースポリシーと IAM ポリシーの双方に記述
- **追加のバケット運用ルール**（TLS のみ、VPC Endpoint 経由のみ、IP アドレスの制限、MFA 要求等）: リソースポリシーに記述

### KMS

#### KMS キーポリシーと IAM ポリシーの使い分け

- **KMS のデフォルトポリシーは変更しない**: このルート権限を削除してしまうと、管理者権限で当該 KMS キーにアクセスできなくなるだけでなく、IAM ポリシーを使った権限制御もできない

**デフォルトポリシー:**

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::[account_id]:root"
  },
  "Action": "kms:*",
  "Resource": "*"
}
```

- **権限制御の推奨**: 可能であれば KMS キーへの権限はキーポリシー側で制御するが、IAM ポリシー側の制御でも可

参照: https://docs.aws.amazon.com/kms/latest/developerguide/iam-policies-best-practices.html

> **注:** 2022 年 10 月の正式リリース時点では、全てのアプリケーションで IAM ポリシー側で制御を行っている。これはルールの策定前に IAM ポリシー側に記載して開発を行ったため。

### RDS

#### IAM Database Authentication の利用

IAM Database Authentication の利用には高負荷時にパフォーマンス上の懸念があるため、標準の ID/パスワードの利用で OK（パスワードは Secrets Manager に保管）

### Lambda

#### 全般

- 利用言語は現在利用可能な最新バージョンを使用している
- 機微データ（アクセスキー）を環境変数に設定していない
- 複数の Lambda 関数で IAM ロールを使い回していない

### ECR

#### 全般

- VPC からのアクセスには VPC Endpoint を利用する

### Amazon Lex

#### 全般

- 会話ログを有効化しないこと

## 参照

このドキュメントは以下の既存ルールと併せて使用してください:

- `japanese-development.md`: 日本語による開発規則
- `git-conventions.md`: Git ブランチ名とコミットメッセージの規約
