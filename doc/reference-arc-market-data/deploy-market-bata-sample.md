# [マーケットデータ] サンプルアプリケーションのデプロイ手順

[リポジトリの README に戻る](../README.md)

ここでは BLEA for FSI のガバナンスベースがデプロイされたアカウントに [マーケットデータ] サンプルアプリケーションを導入する手順について記述します。

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 導入手順

### 1. [マーケットデータ] サンプルアプリケーションをデプロイする(Local)

ゲストアカウントに SSO で認証している状態からのデプロイメントの手順を示します。

#### 1-1. ゲストアプリケーションの Context を設定する

BLEA for FSI 版と同じ手順で Context を設定します。

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/bleafsi-guest-market-data-sample.ts",
  "context": {
    "pjPrefix": "BLEA-FSI",
    "dev": {
      "description": "Context samples for Dev",
      "envName": "Development",
      "vpcCidr": "10.100.0.0/16",
      "securityNotifyEmail": "notify-security@example.com"
    }
  }
}
```

この設定内容は以下の通りです。

| key                 | value                                          |
| ------------------- | ---------------------------------------------- |
| description         | 環境についてのコメント                         |
| envName             | 環境名。これが各々のリソースタグに設定されます |
| vpcCidr             | VPC の CIDR                                    |
| securityNotifyEmail | 通知が送られるメールアドレス                   |

#### 1-2. ゲストアプリケーションをデプロイする

（ログインしていない場合）AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

サンプルアプリケーションをデプロイします。

```sh
cd usecases/guest-market-data-sample
npx cdk deploy --all -c environment=dev --profile ct-guest-sso
```

以上でサンプルアプリケーションのデプロイは完了です。

#### 1-3. (参考) AWS CloudTrail で Kinesis Data Streams API コールを記録する

CloudTrail は、Kinesis Data Streams のすべての API コールをイベントとしてキャプチャします。
サポートされているイベントアクティビティは 他の AWS サービスのイベントと一緒にマネジメントコンソールのイベント履歴から参照できます。
また、証跡を作成することでイベントを Amazon S3 バケットへ配信し、継続的に記録できます。
これらによって、Kinesis Data Streams に行われたリクエスト、リクエストが行われた IP アドレス、誰がリクエストを行ったか、いつ行われたか、その他の詳細を確認できます。

詳細は以下をご参照ください。
[AWS CloudTrail を使用した Amazon Kinesis Data Streams API コールのログ記録](https://docs.aws.amazon.com/ja_jp/streams/latest/dev/logging-using-cloudtrail.html)
