# [勘定系] サンプルアプリケーションのデプロイ手順

[リポジトリの README に戻る](../../README.md)

ここでは BLEA for FSI のガバナンスベースがデプロイされたアカウントに [勘定系] サンプルアプリケーションを導入する手順について記述します。

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 導入手順

### 1. [勘定系] サンプルアプリケーションをデプロイする(Local)

ゲストアカウントに SSO で認証している状態からのデプロイメントの手順を示します。

#### 1-1. ゲストアプリケーションの Context を設定する

BLEA for FSI 版と同じ手順で Context を設定します。

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/bleafsi-guest-core-banking-sample.ts",
  "context": {
    "pjPrefix": "BLEA-FSI",
    "dev": {
      "description": "Context samples for Dev",
      "envName": "Development",
      "monitoringNotifyEmail": "notify-security@example.com",
      "dbUser": "dbadmin",
      "primaryRegion": {
        "region": "ap-northeast-1",
        "vpcCidr": "10.100.0.0/16",
        "tgwAsn": 64512
      },
      "secondaryRegion": {
        "region": "ap-northeast-3",
        "vpcCidr": "10.101.0.0/16",
        "tgwAsn": 64513
      }
    }
  }
}
```

この設定内容は以下の通りです。

| key                     | value                                          |
| ----------------------- | ---------------------------------------------- |
| description             | 設定についてのコメント                         |
| envName                 | 環境名。これが各々のリソースタグに設定されます |
| monitoringNotifyEmail   | 通知が送られるメールアドレス                   |
| dbUser                  | AuroraDB へのログインユーザ名                  |
| primaryRegion.region    | プライマリをデプロイするリージョン             |
| primaryRegion.vpcCidr   | プライマリで作成する VPC の CIDR               |
| primaryRegion.tgwAsn    | プライマリで作成する Transit Gateway の ASN    |
| secondaryRegion.region  | セカンダリをデプロイするリージョン             |
| secondaryRegion.vpcCidr | セカンダリで作成する VPC の CIDR               |
| secondaryRegion.tgwAsn  | セカンダリで作成する Transit Gateway の ASN    |

#### 1-2. ゲストアプリケーションをデプロイする

（ログインしていない場合）AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

ゲストアカウントで CDK ブートストラップを実行します（Context に指定した 2 つのリージョンでブートストラップ処理が行われます）。

```sh
cd usecases/guest-core-banking-sample
npx cdk bootstrap -c environment=dev --profile ct-guest-sso
```

サンプルアプリケーションをデプロイします。

```sh
npx cdk deploy --all -c environment=dev --profile ct-guest-sso
```

> NOTE:  
> デプロイ時に IAM ポリシーに関する変更確認をスキップしたい場合は  
> `--require-approval never` オプションを指定して下さい

#### 1-3. (オプション) 動作確認用 NLB にアクセスし動作確認する

インターネットからサンプルアプリへの接続を可能にする、動作確認用の NLB をデプロイしています。  
デプロイ完了後、 `Outputs` の `BLEA-FSI-core-banking-nlb-only-for-test.TestNlbUrl` の URL を開くことでサンプルアプリにアクセスできます。

以上でサンプルアプリケーションのデプロイは完了です。
