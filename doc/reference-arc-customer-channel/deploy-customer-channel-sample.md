# [顧客チャネル] サンプルアプリケーションのデプロイ手順

[リポジトリの README に戻る](../../README.md)

ここでは BLEA for FSI のガバナンスベースがデプロイされたアカウントに [顧客チャネル] サンプルアプリケーションを導入する手順について記述します。

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 導入手順

### 1. （AWS IAM Identity Center（旧 AWS SSO) との SAML 連携時のみ） AWS IAM Identity Center クラウドアプリケーションを追加する (MC)

AWS IAM Identity Center の設定を行うために管理者アカウントでマネジメントコンソールを開きます。
以下の手順に従い、アプリケーションを追加します。

[AWS IAM Identity Center ユーザーガイド > アプリケーションの割り当て > クラウドアプリケーション](https://docs.aws.amazon.com/ja_jp/singlesignon/latest/userguide/saasapps.html#saasapps-addconfigapp)

- 追加するアプリケーションとして **Amazon Connect** を選択します。
- **IAM Identity Center メタデータ** の項にある **IAM Identity Center SAML メタデータファイル** をダウンロードします。
- それ以外の項目は一旦全てデフォルトで追加します。

AWS IAM Identity Center（旧 AWS SSO) と Amazon Connect の連携については以下の資料も参照してください。

[IAM アイデンティティーセンター を使用して Amazon Connect インスタンスの SAML 2.0 ベースの認証をセットアップするにはどうすればよいですか?](https://aws.amazon.com/jp/premiumsupport/knowledge-center/connect-saml-2-authentication-aws-sso/)

### 2. サンプルアプリケーションをデプロイする (Local)

ゲストアカウントに SSO で認証している状態からのデプロイメントの手順を示します。

#### 2-1. ゲストアプリケーションの Context を設定する

BLEA for FSI 版と同じ手順で Context を設定します。

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/bleafsi-guest-customer-channel-sample.ts",
  "context": {
    "dev": {
      "description": "Context samples for Dev",
      "envName": "Development",
      "primaryRegion": {
        "region": "ap-northeast-1",
        "connectInstance": {
          "instanceAlias": "my-connect-instance-yyyymmdd-primary",
          "inboundCallsEnabled": true,
          "outboundCallsEnabled": true,
          "contactFlows": [
            {
              "type": "CONTACT_FLOW",
              "name": "SampleInboundContactFlow"
            }
          ],
          "identityManagementType": "CONNECT_MANAGED"
        }
      },
      "secondaryRegion": {
        "region": "ap-southeast-1",
        "connectInstance": {
          "instanceAlias": "my-connect-instance-yyyymmdd-secondary"
        }
      },
      "tertiaryRegion": {
        "region": "ap-northeast-3"
      }
    }
  }
}
```

この設定内容は以下の通りです。

| key                                                               | value                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| description                                                       | 設定についてのコメント                                                                                                                                                                                                                                                                   |
| envName                                                           | 環境名                                                                                                                                                                                                                                                                                   |
| primaryRegion.region                                              | プライマリリージョン用スタックをデプロイするリージョン                                                                                                                                                                                                                                   |
| primaryRegion.connectInstance.instanceAlias                       | プライマリリージョン用スタックの Amazon Connect インスタンス                                                                                                                                                                                                                             |
| primaryRegion.connectInstance.inboundCallsEnabled                 | プライマリリージョン用スタックの Amazon Connect インスタンスでインバウンド通話を許可するフラグ (`true` または `false`)                                                                                                                                                                   |
| primaryRegion.connectInstance.outboundCallsEnabled                | プライマリリージョン用スタックの Amazon Connect インスタンスでアウトバウンド通話を許可するフラグ (`true` または `false`)                                                                                                                                                                 |
| primaryRegion.connectInstance.identityManagementType              | プライマリリージョン用スタックの Amazon Connect インスタンスにおける ID 管理方式の指定 (`"CONNECT_MANAGED"`, `"SAML"`, `"EXISTING_DIRECTORY"` のいずれか)                                                                                                                                |
| primaryRegion.connectInstance.contactFlows[].type                 | プライマリリージョン用スタックの Amazon Connect インスタンスに追加するコンタクトフローの種別 (`"CONTACT_FLOW"`, `"CUSTOMER_QUEUE"`, `"CUSTOMER_HOLD"`, `"CUSTOMER_WHISPER"`, `"AGENT_HOLD"`, `"AGENT_WHISPER"`, `"OUTBOUND_WHISPER"`, `"AGENT_TRANSFER"`, `"QUEUE_TRANSFER"` のいずれか) |
| primaryRegion.connectInstance.contactFlows[].name                 | プライマリリージョン用スタックの Amazon Connect インスタンスに追加するコンタクトフローの名前 <br> `asset/`にある JSON ファイルがリソースとして使われます。                                                                                                                               |
| primaryRegion.connectInstance.samlProvider.metadataDocumentPath   | (`identityManagementType` が `"SAML"` の場合) プライマリリージョン用スタックの Amazon Connect インスタンスが使用する SAML 連携時のメタデータのパス （`/usecases/guest-customer-channel-sample` からの相対パス）                                                                          |
| primaryRegion.connectInstance.samlProvider.name                   | (`identityManagementType` が `"SAML"` の場合) プライマリリージョン用スタックの Amazon Connect インスタンスの SAML Provider の名前                                                                                                                                                        |
| secondaryRegion.region                                            | セカンダリリージョン用スタックをデプロイするリージョン                                                                                                                                                                                                                                   |
| secondaryRegion.connectInstance.instanceAlias                     | セカンダリリージョン用スタックの Amazon Connect インスタンス                                                                                                                                                                                                                             |
| secondaryRegion.connectInstance.inboundCallsEnabled               | セカンダリリージョン用スタックの Amazon Connect インスタンスでインバウンド通話を許可するフラグ (`true` または `false`)                                                                                                                                                                   |
| secondaryRegion.connectInstance.outboundCallsEnabled              | セカンダリリージョン用スタックの Amazon Connect インスタンスでアウトバウンド通話を許可するフラグ (`true` または `false`)                                                                                                                                                                 |
| secondaryRegion.connectInstance.identityManagementType            | セカンダリリージョン用スタックの Amazon Connect インスタンスにおける ID 管理方式の指定 (`"CONNECT_MANAGED"`, `"SAML"`, `"EXISTING_DIRECTORY"` のいずれか)                                                                                                                                |
| secondaryRegion.connectInstance.contactFlows[].type               | セカンダリリージョン用スタックの Amazon Connect インスタンスに追加するコンタクトフローの種別 (`"CONTACT_FLOW"`, `"CUSTOMER_QUEUE"`, `"CUSTOMER_HOLD"`, `"CUSTOMER_WHISPER"`, `"AGENT_HOLD"`, `"AGENT_WHISPER"`, `"OUTBOUND_WHISPER"`, `"AGENT_TRANSFER"`, `"QUEUE_TRANSFER"` のいずれか) |
| secondaryRegion.connectInstance.contactFlows[].name               | セカンダリリージョン用スタックの Amazon Connect インスタンスに追加するコンタクトフローの名前 <br> `asset/`にある JSON ファイルがリソースとして使われます。                                                                                                                               |
| secondaryRegion.connectInstance.samlProvider.metadataDocumentPath | (`identityManagementType` が `"SAML"` の場合) セカンダリリージョン用スタックの Amazon Connect インスタンスが使用する SAML 連携時のメタデータのパス （`/usecases/guest-customer-channel-sample` からの相対パス）                                                                          |
| secondaryRegion.connectInstance.samlProvider.name                 | (`identityManagementType` が `"SAML"` の場合) セカンダリリージョン用スタックの Amazon Connect インスタンスの SAML Provider の名前                                                                                                                                                        |
| tertiaryRegion.region                                             | ターシャリリージョン用スタックをデプロイするリージョン                                                                                                                                                                                                                                   |

SAML 連携時は `identityManagementType` の部分を以下の様に書き換えます。

```json
...
          "identityManagementType": "SAML",
          "samlProvider": {
            "metadataDocumentPath": "[AWS IAM Identity Center からダウンロードしたメタデータファイルへのパス]"
          }
...
```

#### 2-2. ゲストアプリケーションをデプロイする

（ログインしていない場合） AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

ゲストアカウントで CDK ブートストラップを実行します（Context に指定した 3 つのリージョンでブートストラップ処理が行われます）。

```sh
cd usecases/guest-customer-channel-sample
npx cdk bootstrap -c environment=dev --profile ct-guest-sso
```

サンプルアプリケーションをデプロイします。

```sh
npx cdk deploy --all -c environment=dev --profile ct-guest-sso
```

> NOTE:  
> デプロイ時に IAM ポリシーに関する変更確認をスキップしたい場合は  
> `--require-approval never` オプションを指定して下さい

### 3. （AWS IAM Identity Center（旧 AWS SSO) との SAML 連携時のみ） AWS IAM Identity Center クラウドアプリケーションの設定を変更する (MC)

デプロイした CDK スタックの出力結果を元に、AWS IAM Identity Center の設定を変更します。
本手順の詳細については、以下の記事も参照してください。

<https://aws.amazon.com/blogs/contact-center/enabling-federation-with-aws-single-sign-on-and-amazon-connect/>

#### 3-1. ユーザー属性のマッピングを変更する

以下の手順に従い、 Amazon Connect インスタンスのユーザー属性を AWS IAM Identity Center 属性にマッピングします。

<https://docs.aws.amazon.com/ja_jp/singlesignon/latest/userguide/mapawsssoattributestoapp.html>

| 属性                                                     | 値                                         |
| -------------------------------------------------------- | ------------------------------------------ |
| `Subject`                                                | `${user:email}`                            |
| `https://aws.amazon.com/SAML/Attributes/RoleSessionName` | `${user:email}`                            |
| `https://aws.amazon.com/SAML/Attributes/Role`            | `[IAMロールのARN],[SAMLプロバイダーのARN]` |

例えば、CDK スタックのデプロイ時に以下の出力が得られたと仮定します。

```
Outputs:
BLEAFSICustomerChannelPrimaryStack.ConnectInstanceSamlProviderArn0DCAAE85 = arn:aws:iam::123456789012:saml-provider/ConnectInstanceSamlProvider-XXXXXXXXXXXX
BLEAFSICustomerChannelPrimaryStack.ConnectInstanceSamlRelayState4B7151BC = https://ap-northeast-1.console.aws.amazon.com/connect/federate/aaaaaaaa-0000-bbbb-1111-cccccccccccc
BLEAFSICustomerChannelPrimaryStack.ConnectInstanceSamlRoleArnD5AF7EEB = arn:aws:iam::123456789012:role/BLEAFSICustomerChannelPri-ConnectInstanceSamlRole2-YYYYYYYYYYYY
```

この際、 `https://aws.amazon.com/SAML/Attributes/Role` の項目には `arn:aws:iam::123456789012:role/BLEAFSICustomerChannelPri-ConnectInstanceSamlRole2-YYYYYYYYYYYY,arn:aws:iam::123456789012:saml-provider/ConnectInstanceSamlProvider-XXXXXXXXXXXX` と指定します。

#### 3-2. リレーステートを変更する

クラウドアプリケーションの画面で、右上の **アクション** を選択し、 **設定の編集** を選択します。
**アプリケーションのプロパティ** の項目から **リレー状態** を変更します。
上のスタックの出力においては、 `https://ap-northeast-1.console.aws.amazon.com/connect/federate/aaaaaaaa-0000-bbbb-1111-cccccccccccc` をリレーステートとして指定します。

### 4. (オプション) Amazon Connect インスタンスにアクセスして動作確認する (MC)

マネジメントコンソールから Amazon Connect インスタンスを表示して動作確認を行います。

#### 4-1. （AWS IAM Identity Center（旧 AWS SSO) との SAML 連携時のみ）ユーザーを追加して動作確認する

まず、以下の手順に基づいて、AWS IAM Identity Center 上でユーザーを作成します。

<https://docs.aws.amazon.com/ja_jp/singlesignon/latest/userguide/addusers.html>

次に、以下の手順に基づいて、AWS IAM Identity Center クラウドアプリケーションに割り当てます。

<https://docs.aws.amazon.com/ja_jp/singlesignon/latest/userguide/assignuserstoapp.html>

Amazon Connect コンソールを開き、同じくユーザーを追加します。この際、AWS IAM Identity Center（旧 AWS SSO) 側で追加したメールアドレスと同様のメールアドレスでユーザーを追加します。

<https://docs.aws.amazon.com/ja_jp/connect/latest/adminguide/user-management.html#add-a-user>

AWS IAM Identity Center のポータル画面から追加したユーザーでログインし、Amazon Connect コンソールに正常にログインできることを確認します。

以上でサンプルアプリケーションのデプロイは完了です。
