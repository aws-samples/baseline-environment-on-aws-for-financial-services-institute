# ゲストアカウントでの大阪リージョンへのガバナンスベースのセットアップ手順

[[BLEA for FSI ガバナンスベースのセットアップ手順に戻る]](./deploy-governance-base.md)

大阪リージョンで BLEA for FSI によるガバナンスベースを適用するには下記の手順に従って下さい。

## 導入手順[全体の流れ]

| #   | 手順                                                                                                                                              | MC/Local | 対象アカウント                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------- |
| 1   | [Security Hub の検出結果の集約で大阪リージョンを追加](./deploy-governance-base-to-osa.md#1-security-hub-の検出結果の集約で大阪リージョンを追加mc) | MC       | CT Audit アカウント                |
| 2   | [大阪リージョンでの Security Hub の有効化](./deploy-governance-base-to-osa.md#2-大阪リージョンでの-security-hub-の有効化mc)                       | MC       | ゲストアカウント                   |
| 3   | [大阪リージョンでの GuardDuty の有効化](./deploy-governance-base-to-osa.md#3-大阪リージョンでの-guardduty-の有効化mc)                             | MC       | ゲストアカウント                   |
| 4   | [ゲストアカウント用ガバナンスベースをデプロイする](./deploy-governance-base-to-osa.md#4-2-ゲストアカウントにガバナンスベースをデプロイするlocal)  | Local    | CT 管理アカウント/ゲストアカウント |

## 1. Security Hub の検出結果の集約で大阪リージョンを追加(MC)

マルチリージョンでの Security Hub の検出結果を集約するために設定を変更します。

1. Control Tower Audit アカウントでログイン
2. Security Hub の設定画面で[設定]を選択
3. [リージョン]タブで[編集]をクリックして設定編集画面を表示
4. 利用可能なリージョンで"アジアパシフィック（大阪）"をチェックして保存

- [AWS ドキュメント: リージョン間の結果を集約する](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/finding-aggregation.html)

## 2. 大阪リージョンでの Security Hub の有効化(MC)

大阪リージョンで Security Hub を有効化します。

1. ゲストアカウントでログイン
2. リージョンを"アジアパシフィック（大阪）"に切り替える
3. Security Hub を選択し、[Security Hub に移動]ボタンを押して Security Hub を大阪リージョンで有効化

> NOTE: セキュリティ基準 の 「AWS 基礎セキュリティのベストプラクティス」 と 「CIS AWS Foundations Benchmark」を有効化するかは、組織の基準に従って下さい。

> - [AWS ドキュメント: Security Hub を有効にする](https://docs.aws.amazon.com/ja_jp/securityhub/latest/userguide/securityhub-enable.html)

## 3. 大阪リージョンでの GuardDuty の有効化(MC)

大阪リージョンで GuardDuty を有効化します。

1. ゲストアカウントでログイン
2. リージョンを"アジアパシフィック（大阪）"に切り替える
3. GuardDuty を選択し、[今すぐ始める]ボタンを押して GuardDuty を大阪リージョンで有効化

> - [AWS ドキュメント: GudardDuty の開始方法](https://docs.aws.amazon.com/ja_jp/guardduty/latest/ug/guardduty_settingup.html)

## 4. ゲストアカウント用ガバナンスベースをデプロイする(Local)

### 4-1. デプロイ情報(Context)を設定する

デプロイのためにパラメータを指定する必要があります。 BLEA for FSI 版のゲストアカウント ガバナンスベースの設定ファイルは以下になります。

```sh
usecases/base-ct-guest/bin/parameter.ts
```

paramter.ts の設定については[こちら](./deploy-governance-base.md#7-1-デプロイ情報contextを設定するlocal)を参照

大阪リージョンへのデプロイでは下記の要素を指定する必要があります。

| 変数名               | 値                                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| secondary.region     | デプロイ対象の Secondary リージョン（大阪 ap-northeast-3 を想定）。能                                                                                                                                             |
| cloudTrailBucketName | Log Archive アカウントに作成した 集約ログ用の S3 バケット名（[手順 BLEA for FSI ガバナンスベースのセットアップ手順 6.2](./deploy-governance-base.md#6-2-log-archive-アカウントにガバナンスベースをデプロイする)） |

```js
  securityNotifyEmail: 'notify-security@example.com',
  cloudTrailBucketName: 'bleafsi-base-sharedlogs-resource-123456789012',
```

[修正の例]

### 4-2. ゲストアカウントにガバナンスベースをデプロイする(Local)

AWS IAM Identity Center（旧 AWS SSO) を使って **ゲストアカウント** にログインします。管理アカウントからログアウトしてから再度ログインして下さい。

```sh
aws sso logout --profile ct-management-sso
aws sso login --profile ct-guest-sso
```

ゲストアカウントのガバナンスベースをデプロイします（大阪リージョンの CDK ブートストラップは完了している前提です）。

```sh
cd usecases/base-ct-guest
npx cdk deploy BLEAFSI-Base-Secondary-Dev --profile ct-guest-sso
```

> スタック名は環境ごとに異なります。xxx-Dev は開発環境用のスタック名です。

このデプロイによってゲストアカウントの大阪リージョンに以下の機能がセットアップされます。

- AWS Health イベントの通知
- セキュリティに影響する変更操作の通知
- メールによるセキュリティイベントの通知
- S3 バケット作成 [SSM セッションマネージャーの S3 ロギング]

以下の内容は Control Tower およびセキュリティサービスの Organizations 対応により設定されます。

- CloudTrail による API のロギング
- AWS Config による構成変更の記録
- Security Hub による通知の集約
- GuardDuty による異常なふるまいの検知

### 4-3. (オプション) SSM セッションマネージャーの S3 ログ出力を手動でセットアップする(MC)

- [手順] [ssm セッションマネージャーの s3 ログ出力を手動でセットアップする](./deploy-governance-base.md#7-5-オプション-ssm-セッションマネージャーの-s3-ログ出力を手動でセットアップするmc)

### 4-4. (オプション) 他のベースラインセットアップを手動でセットアップする(MC)

- [手順] [他のベースラインを手動でセットアップする](./deploy-governance-base.md#7-6-オプション-他のベースラインを手動でセットアップするmc)

### 4-5. セキュリティ指摘事項の修復(MC)

- [手順] [セキュリティ指摘事項の修復](./deploy-governance-base.md#7-4-セキュリティ指摘事項の修復)

以上で大阪リージョンへのガバナンスベースラインのデプロイは完了です。
