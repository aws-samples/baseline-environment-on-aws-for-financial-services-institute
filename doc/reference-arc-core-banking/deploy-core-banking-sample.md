# [勘定系] ワークロード サンプルコードのデプロイ手順

[リポジトリの README に戻る](../../README.md)

ここでは BLEA for FSI のガバナンスベースがデプロイされたアカウントに [勘定系] ワークロードのサンプルコードを導入する手順について記述します。

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 導入手順

ゲストアカウントに SSO で認証している状態からのデプロイメントの手順を示します。

#### 1. ゲストアカウントデプロイ用の AWS CLI プロファイルを設定する

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

#### 2. 環境別の設定を指定する

デプロイ前に環境別（開発、ステージング、本番等）の情報を指定する必要があります。下記の typescript ファイルを編集します。

```sh
usecases/guest-core-banking-sample/bin/parameter.ts
```

このサンプルは dev と staging という 開発、検証用の設定を定義する例です。本番アカウントにもデプロイできるようにするには、prod 用の定義を追加します。

```js
// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  notifyEmail: 'notify-monitoring@example.com',
  dbUser: 'dbadmin',
  hostedZoneName: 'example.com',
  primary: {
    region: 'ap-northeast-1',
    regionCidr: '10.100.0.0/16',
    vpcCidr: '10.100.0.0/20',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    regionCidr: '10.101.0.0/16',
    vpcCidr: '10.101.0.0/20',
    tgwAsn: 64513,
  },
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  account: '111111111111',
  notifyEmail: 'notify-monitoring@example.com',
  dbUser: 'dbadmin',
  hostedZoneName: 'example.com',
  primary: {
    region: 'ap-northeast-1',
    regionCidr: '10.100.0.0/16',
    vpcCidr: '10.100.0.0/20',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    regionCidr: '10.101.0.0/16',
    vpcCidr: '10.101.0.0/20',
    tgwAsn: 64513,
  },
};
```

この設定内容は以下の通りです。

| key                  | value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| envName              | 環境名。これが各々のリソースタグに設定されます                    |
| account              | デプロイ対象のアカウント ID                                       |
| notifyEmail          | 通知が送られるメールアドレス                                      |
| dbUser               | AuroraDB へのログインユーザ名                                     |
| hostedZoneName       | Route53 Private Hosted Zone に指定するドメイン名                  |
| primary.region       | プライマリをデプロイするリージョン                                |
| primary.regionCidr   | プライマリリージョンの CIDR                                       |
| primary.vpcCidr      | プライマリで作成する VPC の CIDR（rigionCidr に含まれる必要あり） |
| primary.tgwAsn       | プライマリで作成する Transit Gateway の ASN                       |
| secondary.region     | セカンダリをデプロイするリージョン                                |
| secondary.regionCidr | セカンダリリージョンの CIDR                                       |
| secondary.vpcCidr    | セカンダリで作成する VPC の CIDR（rigionCidr に含まれる必要あり） |
| secondary.tgwAsn     | セカンダリで作成する Transit Gateway の ASN                       |

#### 3. テスト用サンプルアプリケーションをデプロイ設定

勘定系ワークロードのサンプルコードでは、ECS コンテナ上で稼働するサンプルアプリケーションとして下記の 2 種類を提供します。

1. amazon-ecs-sample として公開されている PHP ベースのアプリケーション  
   https://hub.docker.com/r/amazon/amazon-ecs-sample

2. マルチリージョン環境で動作するマイクロサービス・アプリケーション  
   実際に東京リージョン/大阪リージョンでフェールオーバー可能な TypeScript で実装されたマイクロサービス・アプリケーション

デフォルトでは いずれのアプリケーションも、勘定系ワークロードのリソースと同時に AWS アカウント環境にはデプロイされません。サンプルアプリケーションをデプロイする場合は、下記の設定ファイルを変更して下さい。

設定ファイル: /usecases/guest-core-banking-sample/bin/parameter.ts

39 行目 または 47 行目の `deploy`フラグを `true` に変更して下さい。

> 注：どちらか片方のアプリケーションのみをデプロイするようにして下さい。

```
///// テスト用サンプルアプリケーション の設定 //////

//シンプルなECSコンテナアプリケーションの設定
export const SampleEcsAppParameter = {
  //デプロイする場合は true に指定
  deploy: false,
  //動作確認用 NLB を作成するかどうか
  createTestResource: true,
};

//マルチリージョン マイクロサービス・アプリケーションの設定
export const SampleMultiRegionAppParameter = {
  //デプロイする場合は true に指定
  deploy: false,
  //実行確認用のクライアントを配置するVPCのCIDR
  appClientVpcCidr: '10.103.0.0/24',
};
```

マルチリージョン マイクロサービス・アプリケーションは、デプロイ時にローカル環境で docker イメージをビルドします。そのため、docker デーモンが起動している必要があります。  
ビルド時にエラーが発生した場合は、[こちら](./workaround-for-deploy-sample-app.md)を参照して下さい

2 のマイクロサービス・アプリケーションの詳細およびデプロイ手順については[こちら](../../usecases/guest-core-banking-sample/sample-multi-region-app/README.md)を参照して下さい。

#### 4. 勘定系ワークロードをデプロイする

（ログインしていない場合）AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

ゲストアカウントで CDK ブートストラップを実行します（parameter.ts に指定した 2 つのリージョンでブートストラップ処理が行われます）。

```sh
cd usecases/guest-core-banking-sample
npx cdk bootstrap --profile ct-guest-sso
```

サンプルコードをデプロイします。勘定系ワークロードの CDK サンプルコードは 2 つのスタックから構成されていて、順に実行されます。

| スタック                         | 説明                                               |
| -------------------------------- | -------------------------------------------------- |
| BLEAFSI-CoreBanking-primary-xx   | 主リージョン（東京リージョン）にリソースをデプロイ |
| BLEAFSI-CoreBanking-secondary-xx | 副リージョン（大阪リージョン）にリソースをデプロイ |

```sh
npx cdk deploy "*Dev" --require-approval never --profile ct-guest-sso
```

> NOTE:
>
> - `"*Dev"` はデプロイ対象の開発環境用のスタック（末尾が`-DEV`のスタック）を実行します。環境（開発、ステージング、本番）によって変更して下さい（例 "\*Prod" ）
> - デプロイ時に IAM ポリシーに関する変更確認をスキップするために `--require-approval never` オプションを指定しています
> - デプロイ時に、以下のリソースで、タイミングによって Create_Failed エラーが発生するケースがあります。その場合はデプロイの再実行をお願いします。
>   - AWS::ECS::ClusterCapacityProviderAssociations
>   - AWS::DynamoDB::GlobalTable

2 つ目のスタックである `BLEAFSI-CoreBanking-secondary-Dev`の実行が完了しますと、Output として下記の 3 つの CLI コマンドが表示されますので、順に実行していきます。

```
Outputs:
BLEAFSI-CoreBanking-secondary-Dev.CLIforTGWpeeringacceptance = aws ec2 accept-transit-gateway-peering-attachment --region ap-northeast-1 --transit-gateway-attachment-id tgw-attach-008xxxx --profile ct-guest-sso
BLEAFSI-CoreBanking-secondary-Dev.CLIforaddingTGWrouteinprimaryregion = aws ec2 create-transit-gateway-route --region ap-northeast-1 --destination-cidr-block 10.101.0.0/16 --transit-gateway-route-table-id tgw-rtb-069xxx --transit-gateway-attachment-id tgw-attach-008xxx --profile ct-guest-sso
BLEAFSI-CoreBanking-secondary-Dev.CLIforaddingTGWrouteinsecondaryregion = aws ec2 create-transit-gateway-route --region ap-northeast-3 --destination-cidr-block 10.100.0.0/16 --transit-gateway-route-table-id tgw-rtb-094xxx --transit-gateway-attachment-id tgw-attach-008xxx --profile ct-guest-sso
```

| Output                                                                  | 説明                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| BLEAFSI-CoreBanking-secondary-Dev.CLIforTGWpeeringacceptance            | 主リージョンと副リージョンの TGW をピアリングするための TGW ピアリングの承認を実施する CLI |
| BLEAFSI-CoreBanking-secondary-Dev.CLIforaddingTGWrouteinprimaryregion   | 主リージョンの Transit Gateway のルートテーブル に 副リージョンへのルートを追加する CLI    |
| BLEAFSI-CoreBanking-secondary-Dev.CLIforaddingTGWrouteinsecondaryregion | 副リージョンの Transit Gateway のルートテーブル に 主リージョンへのルートを追加する CLI    |

コンソールから CLI コマンドを実行して、主リージョンと副リージョンの TGW をピアリングするための TGW ピアリングの承認を実施します。

```sh
aws ec2 accept-transit-gateway-peering-attachment --region <主リージョン> --transit-gateway-attachment-id xx --profile ct-guest-sso
```

アクセプトが有効になるには少し時間がかかりますので、2-3 分待ってから次のコマンドを入力して下さい。

コンソールから CLI コマンドを実行して、主リージョンの Transit Gateway のルートテーブル に 副リージョンへのルートを追加します。

```sh
aws ec2 create-transit-gateway-route --region <主リージョン> --destination-cidr-block <副リージョンのCIDR> --transit-gateway-route-table-id <主リージョンのTGWのルートテーブルのID> --transit-gateway-attachment-id <TGWのPeering AttachmentのID> --profile ct-guest-sso
```

コンソールから CLI コマンドを実行して、副リージョンの Transit Gateway のルートテーブル に 主リージョンへのルートを追加します。

```sh
aws ec2 create-transit-gateway-route --region <副リージョン> --destination-cidr-block <副リージョンのCIDR> --transit-gateway-route-table-id <副リージョンのTGWのルートテーブルのID> --transit-gateway-attachment-id <TGWのPeering AttachmentのID> --profile ct-guest-sso

```

以上で、勘定系ワークロードのデプロイは完了です。

#### 5. (オプション) マルチリージョン マイクロサービスアプリケーション を使用する

2 のマイクロサービス・アプリケーションをご利用になる場合は追加のセットアップが必要ですので、[こちら](../../usecases/guest-core-banking-sample/sample-multi-region-app/README.md)の手順に従って、ECS コンテナアプリケーションおよび Aurora DB のセットアップを行って下さい。

#### 6. (オプション) 動作確認用 NLB にアクセスし ECS サンプルアプリケーションの動作確認を行う

ECS サンプルアプリケーションをデプロイすると、インターネットから 1 の ECS サンプルアプリへの接続を可能にする、動作確認用の NLB をデプロイしています。  
デプロイ完了後、 `Outputs` の `BLEA-FSI-core-banking-nlb-only-for-test.TestNlbUrl` の URL を開くことでサンプルアプリにアクセスできます。
