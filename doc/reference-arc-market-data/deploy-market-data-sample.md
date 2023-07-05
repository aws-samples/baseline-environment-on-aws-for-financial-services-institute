# [マーケットデータ] サンプルアプリケーションのデプロイ手順

[リポジトリの README に戻る](../../README.md)

ここでは BLEA for FSI のガバナンスベースがデプロイされたアカウントに [マーケットデータ] サンプルアプリケーションを導入する手順について記述します。

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 導入手順

### 1. [マーケットデータ] サンプルアプリケーションをデプロイする(Local)

ゲストアカウントに SSO で認証している状態からのデプロイメントの手順を示します。

#### 1-1. ゲストアカウントデプロイ用の AWS CLI プロファイルを設定する

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

#### 1-3. 環境別の設定を指定する

デプロイ前に環境別（開発、ステージング、本番等）の情報を指定する必要があります。下記の typescript ファイルを編集します。

```sh
usecases/guest-market-data-sample/bin/parameter.ts
```

このサンプルは dev と staging という 開発、検証用の設定を定義する例です。本番アカウントにもデプロイできるようにするには、prod 用の定義を追加します。

```js
export const DevParameter: StackParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  vpcCidr: '10.100.0.0/16',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
  },
};

//// Staging environment parameters ////
export const StageParameter: StackParameter = {
  envName: 'Staging',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
  securityNotifyEmail: 'notify-security@example.com',
  vpcCidr: '10.100.0.0/16',
};
```

この設定内容は以下の通りです。

| key                 | value                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| env.account         | デプロイ対象のアカウント ID。CLI の profile で指定するアカウントと一致している必要があります |
| env.region          | デプロイ対象のリージョン                                                                     |
| envName             | 環境名。これが各々のリソースタグに設定されます                                               |
| vpcCidr             | VPC の CIDR                                                                                  |
| securityNotifyEmail | セキュリティに関する通知が送られるメールアドレス。                                           |

#### 1-3. ゲストアプリケーションをデプロイする

（ログインしていない場合）AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

サンプルアプリケーションをデプロイします。

```sh
cd usecases/guest-market-data-sample
npx cdk deploy BLEAFSI-MarketData-Dev --profile ct-guest-sso
```

> `BLEAFSI-MarketData-Dev` はデプロイ対象の開発環境用のスタック名です。環境（開発、ステージング、本番）によってスタック名は異なります。

以上でサンプルアプリケーションのデプロイは完了です。

#### 1-3. (参考) AWS CloudTrail で Kinesis Data Streams API コールを記録する

CloudTrail は、Kinesis Data Streams のすべての API コールをイベントとしてキャプチャします。
サポートされているイベントアクティビティは 他の AWS サービスのイベントと一緒にマネジメントコンソールのイベント履歴から参照できます。
また、証跡を作成することでイベントを Amazon S3 バケットへ配信し、継続的に記録できます。
これらによって、Kinesis Data Streams に行われたリクエスト、リクエストが行われた IP アドレス、誰がリクエストを行ったか、いつ行われたか、その他の詳細を確認できます。

詳細は以下をご参照ください。
[AWS CloudTrail を使用した Amazon Kinesis Data Streams API コールのログ記録](https://docs.aws.amazon.com/ja_jp/streams/latest/dev/logging-using-cloudtrail.html)
