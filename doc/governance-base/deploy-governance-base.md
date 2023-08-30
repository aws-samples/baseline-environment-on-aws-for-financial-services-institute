# BLEA for FSI ガバナンスベースのセットアップ手順

[リポジトリの README に戻る](../../README.md)

ここでは AWS Control Tower 管理下のアカウントに BLEA for FSI ガバナンスベース を導入する手順について記述します。

Control Tower を導入していないアカウント環境へのガバナンスベースのデプロイ方法については、[こちら](./manual-deploy-governance-base.md)を参照して下さい。

## 導入手順[全体の流れ]

| #   | 手順                                                                                                                                                                                             | MC/Local | 対象アカウント                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------- |
| 1   | [AWS Control Tower およびセキュリティサービスのセットアップ](./deploy-governance-base.md#1-1-aws-control-tower-のセットアップ)                                                                   | MC       | CT 管理アカウント                  |
| 2   | [デプロイ対象のゲストアカウントを AWS Control Tower で作成する](./deploy-governance-base.md#2-1-ゲストアカウントを作成する)                                                                      | MC       | CT 管理アカウント                  |
| 3   | [依存パッケージのインストールとコードのビルド](./deploy-governance-base.md#3-1-リポジトリの取得)                                                                                                 | Local    | -                                  |
| 4   | [AWS IAM Identity Center（旧 AWS SSO) に合わせて AWS CLI の認証情報を設定する](./deploy-governance-base.md#4-1-aws-cli-のバージョンを確認する)                                                   | Local    | -                                  |
| 5   | [Control Tower 管理者 アカウントでの追加設定](./deploy-governance-base.md#5-1-control-tower-管理者アカウントでのガードレールの設定mc)                                                            | MC       | CT 管理アカウント                  |
| 6   | [Log Archive アカウント用ガバナンスベースをデプロイする](./deploy-governance-base.md#6-1-環境別の設定を指定する)                                                                                 | Local    | CT Log Archive アカウント          |
| 7a  | [ゲストアカウント用ガバナンスベースをデプロイする](./deploy-governance-base.md#7-1-デプロイ情報contextを設定するlocal)                                                                           | Local/MC | ゲストアカウント                   |
| 7b  | [Control Tower AFC を利用したゲストアカウント用ガバナンスベースの自動プロビジョニング](./setup-ct-afc.md)                                                                                        | MC       | ゲストアカウント                   |
| 8   | [(オプション） 大阪リージョンにゲストアカウント用ガバナンスベースをデプロイする](./deploy-governance-base.md#8-オプション-大阪リージョンにゲストアカウント用ガバナンスベースをデプロイするlocal) | Local/MC | CT 管理アカウント/ゲストアカウント |

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 導入手順[詳細]

### 1. AWS Control Tower およびセキュリティサービスのセットアップ(MC)

Control Tower を利用することで、ガバナンスベースの一部の機能は自動的に設定されます。Control Tower が対応していないセキュリティサービスは AWS Organizations に対して一括有効化を行うことで、以後新しいアカウントが作られると自動的に設定されるようになります。

ここでは Control Tower をセットアップし、Organizations 全体に対して AWS Security Hub, Amazon GuardDuty および IAM Access Analyzer を有効化する手順を示します。これらの委任アカウントとして Audit アカウントを指定します。

#### 1-1. AWS Control Tower のセットアップ

下記のドキュメントを参考にして Control Tower をセットアップします。

- [AWS ドキュメント: Control Tower のセットアップ](https://docs.aws.amazon.com/controltower/latest/userguide/setting-up.html)

#### 1-2. Security Hub のセットアップ

- [手順]: [Organizations 環境下の Security Hub のセットアップ手順](./manual-deploy-governance-base.md#organizations-環境下の-securityhub-のセットアップ手順)

#### 1-3. Amazon GuardDuty のセットアップ

- [手順]: [Organizations 環境下の GuardDuty のセットアップ手順](./manual-deploy-governance-base.md#organizations-環境下の-guardduty-のセットアップ手順)

#### 1-4. IAM Access Analyzer のセットアップ

- [AWS ドキュメント: Access Analyzer の設定](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-settings.html#access-analyzer-delegated-administrator)

#### 1-5. AWS Trusted Advisor のセットアップ （オプション）

- [AWS ドキュメント: AWS Trusted Advisor の組織ビュー](https://docs.aws.amazon.com/awssupport/latest/user/organizational-view.html)

### 2. デプロイ対象のゲストアカウントを AWS Control Tower で作成する(MC)

#### 2-1. ゲストアカウントを作成する

Control Tower を使って新しいアカウント（ゲストアカウント）を作成します。

- [AWS ドキュメント: Account Factory でのアカウントのプロビジョニングと管理](https://docs.aws.amazon.com/controltower/latest/userguide/account-factory.html#quick-account-provisioning)

### 3. 依存パッケージのインストールとコードのビルド(Local)

#### 3-1. リポジトリの取得

github から BLEA for FSI の git リポジトリを clone して下さい。

```sh
git clone https://github.com/aws-samples/baseline-environment-on-aws-for-financial-services-institute.git
```

[https でコードを取得する例]

#### 3-2. 依存する NPM パッケージのインストール

```sh
# install dependencies
npm ci
```

#### 3-3. git-secrets のセットアップ

> 注
> デプロイするだけの場合はこのステップは必須ではありません

Git に Commit する際に Linter, Formatter, git-secrets によるチェックを行うための Hook を登録します。以下の手順に従ってセットアップしてください。

- [手順]: [Git の pre-commit hook のセットアップ](../how-to.md#git-の-pre-commit-hook-のセットアップ)

### 4. AWS IAM Identity Center（旧 AWS SSO) に合わせて AWS CLI の認証情報を設定する(Local)

恒久的な認証情報も利用可能ですが、Control Tower 環境では AWS IAM Identity Center（旧 AWS SSO) の利用を推奨します。IAM Identity Center によってマネジメントコンソールへのログインおよび SSO 認証による AWS CLI の実行が可能です。

#### 4-1. AWS CLI のバージョンを確認する

CLI のプロファイル設定ではなく、CDK の IAM Identity Center（旧 AWS SSO) 統合を使って認証を取得します。

- [AWS ドキュメント: AWS Single Sign-On を使用するための AWS CLI の設定](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)

次のように CLI のバージョンを確認します:

```sh
aws --version
```

出力結果がバージョン 2 以上であることを確認します

```sh
aws-cli/2.3.0 Python/3.8.8 Darwin/20.6.0 exe/x86_64 prompt/off
```

#### 4-2. Log Archive アカウントデプロイ用の AWS CLI プロファイルを設定する

次に、Control Tower の Log Archive アカウントにデプロイするための CLI プロファイルを設定します。ここではマネジメントアカウントの ID を `1111111111111`, Log Archive アカウントの ID を `222222222222` としています。

~/.aws/config

```text
# for Management Account Login
[profile ct-management-sso]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start/
sso_region = ap-northeast-1
sso_account_id = 1111111111111
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1

# Accessing with AWSControlTowerExecution Role on Logging Account
[profile ct-logging-exec]
role_arn = arn:aws:iam::222222222222:role/AWSControlTowerExecution
source_profile = ct-management-sso
region = ap-northeast-1
```

> NOTE:
>
> Control Tower の仕様により、Audit アカウントにデプロイするためには、まずマネジメントアカウントの `AWSAdministratorAccess` ロールでログインし、Audit アカウントの`AWSAdministratorAccess`ロールにスイッチして処理を実行する必要があります。
>
> `ct-management-sso`プロファイルで SSO ログインすることで、`ct-logging-exec-role`プロファイルを使って Audit アカウント上での操作が可能です。これに CDK からアクセスするため、ラッピングされたプロファイルである `ct-logging-exec` を使用します。

#### 4-3. ゲストアカウントデプロイ用の AWS CLI プロファイルを設定する

ゲストアカウントにデプロイするための AWS CLI プロファイルを設定します。ここではゲストアカウントの ID を`123456789012`としています。

~/.aws/config

```text
# for Guest Account Login
[profile ct-guest-sso]
sso_start_url = https://d-90xxxxxxxx.awsapps.com/start/
sso_region = ap-northeast-1
sso_account_id = 123456789012
sso_role_name = AWSAdministratorAccess
region = ap-northeast-1
```

> NOTE:
>
> `ct-guest-sso`プロファイルで ゲストアカウントに SSO ログインします。これに CDK からアクセスするため、ラッピングされたプロファイルである `ct-guest` を使用します。

#### 4-4. AWS IAM Identity Center（旧 AWS SSO) を使った CLI ログイン

次のコマンドで AWS IAM Identity Center にログインします。ここでは`ct-guest-sso`プロファイルでログインする例を示します。

```sh
aws sso login --profile ct-guest-sso
```

このコマンドによって ブラウザが起動し、AWS IAM Identity Center のログイン画面が表示されます。ゲストアカウントの管理者ユーザー名（メールアドレス）とパスワードを正しく入力すると画面がターミナルに戻り、 AWS CLI で ゲストアカウントでの作業が可能になります。

### 5. Control Tower 管理者 アカウントでの追加設定(MC)

#### 5-1. Control Tower 管理者アカウントでのガードレールの設定(MC)

FISC 安全対策基準への対策のために、Control Tower 管理者アカウント上で組織内の OU に向けて追加のガードレール（選択的|強く推奨）を有効化します。

- [FISC 安全対策基準 実務基準と Control Tower ガードレールでの対策](./ct-guardrails-for-fisc.md)

参考: [AWS Control Tower のガードレール](https://docs.aws.amazon.com/ja_jp/controltower/latest/userguide/guardrails.html)

#### 5-2. Control Tower 管理者アカウントでの AWS IAM Identity Center（旧 AWS SSO) MFA 必須化(MC)

- [手順]: [AWS IAM Identity Center（旧 AWS SSO) MFA のセットアップ手順](./manual-deploy-governance-base.md#aws-ssosingle-sign-on-の-mfa-設定手順)

### 6. Log Archive アカウント用ガバナンスベースをデプロイする(Local)

#### 6-1. 環境別の設定を指定する

デプロイ前に環境別（開発、ステージング、本番等）の情報を指定する必要があります。下記の typescript ファイルを編集します。

```sh
usecases/base-ct-logging/bin/parameter.ts
```

このサンプルは `dev`と`staging` という 開発、検証用の設定を定義する例です。本番アカウントにもデプロイできるようにするには、`prod`用の定義を追加します。

> NOTE:
>
> 開発環境では、AWS SSO でログインしているアカウントにデプロイするように環境変数からアカウントとリージョンを取得しています。`account`にデプロイ対象のアカウントを明示的に指定した場合は、 CLI Profile で指定するアカウント-リージョンと、`account`で指定するものが一致していないとデプロイできなくなります。これによりアカウントに設定したパラメータを確実に管理し、誤ったアカウントにデプロイすることを防ぐことができます。Staging 以降の環境では、できるだけ`account`も指定することをお勧めします。

usecases/base-ct-logging/bin/parameter.ts

```js
// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
};
```

この設定内容は以下の通りです。

| key         | value                                                                                  |
| ----------- | -------------------------------------------------------------------------------------- |
| envName     | 環境名。これが各々のリソースタグに設定されます                                         |
| env.account | デプロイ対象のアカウント ID。 profile で指定するアカウントと一致している必要があります |
| env.region  | デプロイ対象のリージョン（東京 ap-northeast-1 を想定）。                               |

#### 6-2. Log Archive アカウントにガバナンスベースをデプロイする

AWS IAM Identity Center（旧 AWS SSO) を使って Log Archive アカウントにログインします。

```sh
aws sso login --profile ct-management-sso
```

CDK 用バケットをブートストラップします(初回のみ)。

```sh
cd usecases/base-ct-logging
npx cdk bootstrap --profile ct-logging-exec
```

> NOTE:
>
> - ここでは BLEA 環境にインストールしたローカルの cdk を利用するため、`npx`を使用しています。直接`cdk`からコマンドを始めた場合は、グローバルインストールされた cdk が利用されます。
> - cdk コマンドを利用するときに便利なオプションがあります。[デプロイ時の承認をスキップしロールバックさせない](how-to.md#デプロイ時の承認をスキップしロールバックさせない)を参照してください。
> - デプロイ時に IAM ポリシーに関する変更確認をスキップしたい場合は `--require-approval never` オプションを指定して下さい

Log Archive アカウントのガバナンスベースをデプロイします。

```sh
cd usecases/base-ct-logging
npx cdk deploy --profile ct-logging-exec
```

この CDK テンプレートのデプロイによって以下の機能がセットアップされます

- S3 バケット作成 [CloudTrail データイベント, 大阪リージョン用の Config データ]

以下の内容は Control Tower およびセキュリティサービスの Organizations 対応により設定されます。

- CloudTrail による 管理 API のロギング
- AWS Config による構成変更の記録
- Security Hub による通知の集約
- GuardDuty による異常なふるまいの検知

CDK によるデプロイが完了すると、作成された S3 バケット名がコンソールに表示されますので、記録しておいて下さい。

| 表示名                              | 用途                       |
| ----------------------------------- | -------------------------- |
| BLEAFSI-LogBase-Dev.SharedLogBucket | 集約ログ用の S3 バケット名 |

### 7. ゲストアカウント用ガバナンスベースをデプロイする(Local/MC)

> 注意： ControlTower Landing Zone v2.9 以前の環境 または v3.0 にアップデートした環境にガバナンスベースをデプロイする際の注意点については[こちら](./update-for-landigzon30.md)をお読み下さい。環境によってはソースコードの修正が必要になります。

Control Tower AFC の仕組みを使い、ゲストアカウント作成時に自動的にガバナンスベースをプロビジョニングする方法については、[こちら](./setup-ct-afc.md)を参照して下さい。

#### 7-1. デプロイ情報(Context)を設定する(Local)

デプロイのためにパラメータを指定する必要があります。 BLEA for FSI 版のゲストアカウント ガバナンスベースの設定ファイルは以下になります。

```sh
usecases/base-ct-guest/bin/parameter.ts
```

このサンプルは `dev`と`staging` という 開発、検証用の設定を定義する例です。本番アカウントにもデプロイできるようにするには、`prod`用の定義を追加します。

usecases/base-ct-guest/bin/parameter.ts

```js
// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  primary: {
    region: 'ap-northeast-1',
  },
  secondary: {
    region: 'ap-northeast-3',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  account: '111111111111',
  primary: {
    region: 'ap-northeast-1',
  },
  secondary: {
    region: 'ap-northeast-3',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};
```

この設定内容は以下の通りです。

| key                   | value                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| envName               | 環境名。これが各々のリソースタグに設定されます                                                                  |
| account               | デプロイ対象のアカウント ID。 profile で指定するアカウントと一致している必要があります                          |
| primary.region        | デプロイ対象の Primary リージョン（東京 ap-northeast-1 を想定）。                                               |
| secondary.region      | デプロイ対象の Secondary リージョン（大阪 ap-northeast-3 を想定）。大阪リージョンにデプロイしない場合は省略可能 |
| securityNotifyEmail   | セキュリティに関する通知が送られるメールアドレス。                                                              |
| controlTowerKMSKeyArn | 手順 7.5-c 参照。CloudTrail による S3 データイベントを記録する際のみ使用するパラメータ                          |
| cloudTrailBucketName  | 手順 7.5-c 参照。CloudTrail による S3 データイベントを記録する際のみ使用するパラメータ                          |
| targetBuckets         | 手順 7.5-c 参照。CloudTrail による S3 データイベントを記録する際のみ使用するパラメータ                          |

#### 7-2. ゲストアカウントにガバナンスベースをデプロイする(Local)

AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

CDK 用バケットをブートストラップします(初回のみ)。
Paramter.ts でのパラメータの指定に応じて、Primary（東京）リージョンと Secondary（大阪）リージョンで CDK のブートストラップを実行します。

```sh
cd usecases/base-ct-guest
npx cdk bootstrap --profile ct-guest-sso
```

ゲストアカウントのガバナンスベースをデプロイします。

```sh
cd usecases/base-ct-guest
npx cdk deploy BLEAFSI-Base-Primary-Dev --profile ct-guest-sso
```

> スタック名は環境ごとに異なります。xxx-Dev は開発環境用のスタック名です。

> NOTE:  
> デプロイ時に IAM ポリシーに関する変更確認をスキップしたい場合は  
> `--require-approval never` オプションを指定して下さい

CDK テンプレートの実行後に Session Manager ログを保管する S3 バケット名が出力されますので、記録しておいて下さい。

| 表示名                                              | 用途                                   |
| --------------------------------------------------- | -------------------------------------- |
| BLEAFSI-Base-Primary-Dev.SSMSessionManagerLogBucket | Session Manager ログ用の S3 バケット名 |

この CDK テンプレートのデプロイによって以下の機能がセットアップされます

- デフォルトセキュリティグループの閉塞 （逸脱した場合自動修復）
- AWS Health イベントの通知
- セキュリティに影響する変更操作の通知
- メールによるセキュリティイベントの通知
- S3 バケット作成 [SSM セッションマネージャーの S3 ロギング]

以下の内容は Control Tower およびセキュリティサービスの Organizations 対応により設定されます。

- CloudTrail による API のロギング
- AWS Config による構成変更の記録
- Security Hub による通知の集約
- GuardDuty による異常なふるまいの検知

#### 7-3. アカウントの S3 パブリックアクセスのブロック設定（MC)

アカウント全体で Amazon S3 のパブリックアクセスをブロックします。

- [手順] [アカウントのパブリックアクセスブロック設定の構成](https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/configuring-block-public-access-account.html)

#### 7-4. セキュリティ指摘事項の修復

ガバナンスベースをデプロイした後でも、Security Hub のベンチマークレポートで 重要度が CRITICAL あるいは HIGH のレベルでレポートされる検出項目があります。これらに対しては手動で対応が必要です。必要に応じて修復(Remediation)を実施してください。

- [セキュリティ指摘事項の修復](HowTo.md#セキュリティ指摘事項の修復)

#### 7-5. (オプション) SSM セッションマネージャーの S3 ログ出力を手動でセットアップする(MC)

- [手順] [SSM セッションマネージャーの S3 ログ出力を手動でセットアップ](./manual-deploy-governance-base.md#ssm-セッションマネージャーの-s3-ログ出力を手動でセットアップ)

#### 7-6. (オプション) 他のベースラインを手動でセットアップする(MC)

ガバナンスベースでセットアップする他に
AWS はいくつかの運用上のベースラインサービスを提供しています。必要に応じてこれらのサービスのセットアップを行なってください。

#### a. EC2 管理のため AWS Systems Manager Quick Setup を実施する

EC2 を利用する場合は Systems Manager を利用して管理することをお勧めします。AWS Systems Manager Quick Setup を使うことで、EC2 の管理に必要な基本的なセットアップを自動化できます。

- [手順] [Quick Setup ホスト管理](https://docs.aws.amazon.com/systems-manager/latest/userguide/quick-setup-host-management.html)

Quick Setup は以下の機能を提供します:

- Systems Manager で必要となる AWS Identity and Access Management (IAM) インスタンスプロファイルロールの設定
- SSM Agent の隔週自動アップデート
- 30 分ごとのインベントリメタデータの収集
- インスタンスのパッチ不足を検出するための日次スキャン
- 初回のみの、Amazon CloudWatch agent のインストールと設定
- CloudWatch agent の月次自動アップデート

#### b. Trusted Advisor の検知結果レポート

Trusted Advisor は AWS のベストプラクティスをフォローするためのアドバイスを提供します。レポート内容を定期的にメールで受け取ることが可能です。詳細は下記ドキュメントを参照してください。

- [AWS ドキュメント: AWS Trusted Advisor 開始方法](https://docs.aws.amazon.com/awssupport/latest/user/get-started-with-aws-trusted-advisor.html#preferences-trusted-advisor-console)

#### c. Amazon Macie による S3 バケットの機密データ保護

Amazon Macie は機械学習とパターンマッチングにより S3 バケット上に保管された機密データの検出と保護を行うデータプライバシーのサービスです。Macie により自動で継続的に全ての S3 バケットが評価され、PII などの機密データの特定、暗号化されていない／パブリックアクセスが許可された/Organizatios 外のアカウントからの共有などの情報を含む S3 インベントが作成され、アラートが送信されます。

- [AWS ドキュメント: Amazon Macie 開始方法](https://docs.aws.amazon.com/ja_jp/macie/latest/user/getting-started.html)

#### d. CloudTrail による S3 データイベントの記録

デフォルトでは全てのアカウントで CloudTrail が有効化され、管理操作に対する API 呼出が記録されます。データイベントに対する CloudTrail の有効化は必要に応じて実施して下さい。FISC 実務基準への対応の観点では、ユーザーデータが保管される S3 バケットに対しては CloudTrail データイベントの記録を行うことを推奨します。

ゲストアカウントへの CloudTrail データイベント取得の有効化には、CDK テンプレート(lib/bleafsi-base-ct-guest-stack.ts)を修正してデプロイします。Log Archive アカウントに準備した集約 S3 バケットに CloudTrail のログを出力するように CloudTrail 証跡が作成されます。

デプロイする前に パラメータファイル（usecases/base-ct-guest/bin/parameter.ts）を修正して、下記の 3 つの要素を指定して下さい。

| 変数名                | 値                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| controlTowerKMSKeyArn | Control Tower 管理者アカウントで設定されている KMS 暗号化キーの ARN を指定 （例 arn:aws:kms:ap-northeast-1:701111111111:key/11111111-1111-2222-3333-123456789012 調べ方は下記の NOTE を参照 |
| cloudTrailBucketName  | Log Archive アカウントに作成した 集約ログ用の S3 バケット名（[手順 6.2](./deploy-governance-base.md#6-2-log-archive-アカウントにガバナンスベースをデプロイする)）                           |
| targetBuckets         | CloudTrail データイベント取得の対象となる S3 バケット名 (リスト形式で複数指定可)                                                                                                            |

```js
// ----------------------- Environment variables for stack ------------------------------
// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  primary: {
    region: 'ap-northeast-1',
  },
  secondary: {
    region: 'ap-northeast-3',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'arn:aws:kms:ap-northeast-1:1111111111xxx:key/xxx-xxx-xxx-xxx-xxxxxx',
  cloudTrailBucketName: 'bleafsi-base-dev-bucket22222222-xxxxxxxxxxxxx',
  targetBuckets: ['dummy-bucket-name'],
};
```

[修正の例]

> NOTE: Control Tower 管理者アカウントで設定されている KMS 暗号化キーの ARN の調べ方
>
> 1. Control Tower 管理者アカウントにログイン
> 2. Control Tower サービスを表示し、メニューから「ランディングゾーン設定」を選択
> 3. 「設定」タブを選択し、"KMS 暗号化" > "キー ARN" の値をコピー

パラメータファイルに必要な値を設定した後に、CDK テンプレート(lib/bleafsi-base-ct-guest-stack.ts)の項番 6 のコメントを外します。

```js
//6 (オプション) CloudTrail S3データイベントの有効化
//コメントを外して、コードを有効化する
new CloudTrailDataEvent(this, `CloudTrail-DataEvent`, {
  cloudTrailBucketName: props.cloudTrailBucketName,
  targetBuckets: props.targetBuckets,
  controlTowerKMSKeyArn: props.controlTowerKMSKeyArn,
});
```

下記のコマンドを実行して下さい。

```sh
cd usecases/base-ct-guest
npx cdk deploy BLEAFSI-Base-Dev --profile ct-guest-sso
```

> スタック名は環境ごとに異なります。xxx-Dev は開発環境用のスタック名です。

以上でガバナンスベースの Primary（東京）リージョンへのデプロイは完了です。

### 8. (オプション） 大阪リージョンにゲストアカウント用ガバナンスベースをデプロイする(Local)

大阪リージョンを利用したマルチリージョン構成を取られる場合は、以下の手順に従って大阪リージョンにガバナンスベースをセットアップして下さい。

- [手順] [ゲストアカウントでの大阪リージョンへのガバナンスベースのセットアップ手順](./deploy-governance-base-to-osa.md)
