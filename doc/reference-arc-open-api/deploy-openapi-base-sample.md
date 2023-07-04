# [OpenAPI] ベーシック API サンプル環境のデプロイ手順

[リポジトリの README に戻る](../../README.md)

ここでは BLEA for FSI のガバナンスベースがデプロイされたアカウントに [OpenAPI] ベーシック API サンプル環境を導入する手順について記述します。

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 前提・補足

### 1. [OpenAPI] ベーシック API サンプル環境について

- AWS 上でベーシックな API アクセスを提供する環境を構築する際のアーキテクチャサンプルを提供します。

  - API の認証（IdP）として AWS Cognito を、API 管理として Amazon API Gateway を採用しています。
  - ”金融グレード”のよりセキュアな API 通信を行う場合は、[”FAPI サンプル環境”](deploy-openapi-fapi-sample.md) を参照ください。

- 本 API サンプル環境には API からアクセスされるバックエンドシステムの実装は含まれません。
  - サンプル環境構築後の API の確認のために、指定した URL を返す簡単な Lambda 関数を提供しています。

## 導入手順

### 1. 事前作業

参照系 API サンプル環境のデプロイに当たっては、以下の事前作業が必要です。

#### 1-1. Public な DNS ドメインを取得し、Route 53 Public Hosted Zone を作成する(MC)

（ログインしていない場合）AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

有効なドメインを Public Hosted Zone として作成します。

- 例：「apibase.example.com」

#### 1-2. Amazon CloudFront と Amazon API Gateway で利用するサーバー証明書を登録する(MC)

本サンプル環境の導入手順には含まれませんが、Amazon CloudFront と Amazon API Gateway で TLS 通信を行うためサーバー証明書を AWS Certification Manager（ACM) に登録する必要があります。登録するサーバー証明書は、外部認証局から取得したもの、もしくは ACM で作成したものを登録します。サーバー証明書を ACM に登録するリージョンは以下の通りです。

- Amazon CloudFront 用サーバー証明書：バージニア北部(us-east-1)リージョン
- Amazon API Gateway 用サーバー証明書：東京(ap-northeast-1)リージョン

ACM に登録後、各証明書の ARN を AWS マネージメントコンソール で確認し、後続の `2-1` で Context として設定します。

### 2. ベース API サンプル環境をデプロイする(Local)

ゲストアカウントに IAM Access Identity で認証している状態からのデプロイメントの手順を示します。

#### 2-1. ゲストアプリケーションの Context を設定する

BLEA for FSI 版と同じ手順で Context を設定します。

ファイル名: usecases/guest-openapi-base-sample/bin/parameter.ts

```js
//// Development environment parameters ////
export const DevParameter: StackParameter = {
  envName: 'Development',
  customdomainName: 'api.xxxx.xxxxx',
  alterdomainName: 'openapi.xxxx.xxxx',
  certIdarnApigw: 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  certIdarnCf: 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

//// Staging environment parameters ////
export const StageParameter: StackParameter = {
  envName: 'Staging',
  customdomainName: 'api.xxxx.xxxxx',
  alterdomainName: 'openapi.xxxx.xxxx',
  certIdarnApigw: 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  certIdarnCf: 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
};
```

この設定内容は以下の通りです。

| key              | value                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| envName          | 環境名                                                                                                                                  |
| customdomainName | AWS API Gateway に設定するカスタムドメイン名                                                                                            |
| alterdomainName  | AWS CloudFront に設定する代替ドメイン名                                                                                                 |
| certIdarnApigw   | AWS API Gateway 用サーバー証明書の ARN <br> 例 arn:aws:acm:ap-northeast-1:444412345678:certificate/a92d01bd-8dd3-4b3b-9b66-1d5826288664 |
| certIdarnCf      | AWS CloudFront 用サーバー証明書の ARN                                                                                                   |
| env.account      | デプロイ対象のアカウント ID。 profile で指定するアカウントと一致している必要があります                                                  |
| env.region       | デプロイ対象のリージョン                                                                                                                |

#### 2-2. ゲストアプリケーションをデプロイする(Local)

ゲストアカウントで CDK ブートストラップを実行します。(すでに実行済みの場合は不要)

```sh
$ cd usecases/guest-openapi-base-sample
$ npx cdk bootstrap --profile ct-guest-sso
```

サンプル環境をデプロイします。

```sh
$ cd usecases/guest-openapi-base-sample
$ npx cdk deploy --profile ct-guest-sso
```

$ cdk deploy コマンドが正常に終了することを確認します。

#### 2-３. Public ドメインに、AWS CloudFront Distribution の代替ドメイン名、および AWS API Gateway のカスタムドメイン名に対するエイリアスレコードを作成する(MC)

Route 53 に作成した Public Hosted ドメイン(例：「apibase.example.com」)に、エイリアスレコードとして、Context にて指定した以下のドメイン名を登録します。

- customdomainName（Amazon API Gateway に設定するカスタムドメイン名）
- alterdomainName（Amazon CloudFront に設定する代替ドメイン名）

以上で FAPI サンプル環境のデプロイは完了です。

### 3. ゲストアプリケーションにて参照系 API の確認を行う

#### 3-1. API アクセス用ユーザーを作成する(MC)

デプロイした環境で、参照系 API のアクセスを確認するためのテスト用ユーザーを Amazon Cognito に作成します。AWS マネジメントコンソールより以下のユーザープールにテストアクセス用ユーザーを作成してください。(ユーザー名などは任意で結構です）

- ユーザープール名：apiUserPool

後続の手順で Amazon Cognito へアクセスする際に使用するため、以下の情報を記録しておきます。

- ユーザープール ID（`apiUserPool`の ID）
- クライアント ID（`apiUserPoolClient`の ID）

#### 3-2. テスト用ユーザーのパスワード初期化(local)

Amazon Cognito ではユーザー作成後の初回アクセス時にはパスワード変更が必須となるため、この手順では管理者によるパスワードリセットを行います。

\*この手順では AWS CLI を利用するため、環境がない場合は以下のリンクを参照しインストールを行なってください。

- [AWS CLI のインストールと設定](https://docs.aws.amazon.com/ja_jp/streams/latest/dev/kinesis-tutorial-cli-installation.html)

```sh
$ aws cognito-idp admin-set-user-password --user-pool-id `ユーザープールID` --username `テスト用ユーザー名` --password `設定する新パスワード` --permanent
```

#### 3-3. テスト用ユーザーの ID トークンを取得する

テスト用ユーザーの認証を Amazon Cognito で行い、API アクセス用の ID トークンを取得します。

```sh
$ aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id `クライアントID` --auth-parameter USERNAME=`テスト用ユーザー名`,PASSWORD=`パスワード`
```

出力された”IdToken”を記録します。

```sh
(出力例)
$ aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $CLIENTID --auth-parameter USERNAME=$USER,PASSWORD=$PASSWORD
{
    "ChallengeParameters": {},
    "AuthenticationResult": {
        "AccessToken": "eyJra...(省略)....._yBj6K8g",
        "ExpiresIn": 3600,
        "TokenType": "Bearer",
        "RefreshToken": "eyJjdHk....(省略).....Qdjk0S5Cw",
        `"IdToken": "eyJraWQiOiJoTGpyZDRFc08zWVZ4ZWlkdm5PQlJKZ21obHdOVDl5eUdhTVlCalIxZkJnPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI2OTZhMTZiYi1iOWJlLTRkNjQtOTg3NS1jNjQ3YTQxODVmYzYiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmFwLW5vcnRoZWFzdC0xLmFtYXpvbmF3cy5jb21cL2FwLW5vcnRoZWFzdC0xX0U4a2IzYlZFViIsImNvZ25pdG86dXNlcm5hbWUiOiI2OTZhMTZiYi1iOWJlLTRkNjQtOTg3NS1jNjQ3YTQxODVmYzYiLCJvcmlnaW5fanRpIjoiNmVmYWFiZDctZTdiNC00MjhkLTk1OWQtNDYzYTA2NWVlNjEzIiwiYXVkIjoiNTZqZmxhMGVkMDE3cW9qN2w3YnBqNzVydmoiLCJldmVudF9pZCI6ImE4ZmI1NTgzLTJmMmQtNDQ4MC1iNDQyLWRmYjdiYmVlMDg5ZCIsInRva2VuX3VzZSI6ImlkIiwiYXV0aF90aW1lIjoxNjYzMjk3MDAzLCJleHAiOjE2NjMzMDA2MDMsImlhdCI6MTY2MzI5NzAwMywianRpIjoiNTlkM2ZhOTQtMDFlOC00ODAxLWI3NzYtZmFmMGQ0ZjIwNDZjIiwiZW1haWwiOiJkYWkzOS5oYXRhQGdtYWlsLmNvbSJ9.TBiQKKRapIl6e3K9aupr5Q1LKClFwaBflthSOGkEWLd6IyVJ-3SSLf6LCtOucufZ1a5_olIlMwdXmIHSHtmBojIuVrwr_UJOlFnWGUD0dgULASbPfli1DXPkPpHbevp0mnM2OpWqh-YBYRI5He2zXtK7675g3t48lfoxdlB-CROl9QPV7gFNel3HnbyM1FdBV4f_dTxmtVx_IghuT1PdDyDFZoNc5mL2EYwmvG3lvIBeXy2T68DhynA507iOHUI3AWeaCTsXwaIV5THJX9S0n-mXXy3kRdH-2NTQGP1VapWcrOIkiPDOdrwG5DDsahPC9be7Kvy5RN7g6XH4DF8TPA"`
    }
}
```

#### 3-4. ID トークンを使用して API アクセスを行う

取得した ID トークンを使用してデプロイしたサンプル API にアクセスします。

```sh
$ curl -H GET 'https://`AWS CloudFront代替ドメイン名`/test' -H 'Authorization: `取得したIDトークン`'
```

```sh
(出力例)
$ curl -H GET 'https://openapi-base.apibase.example.com/test' -H 'Authorization: `取得したIDトークン`'

Hello, Sample Open API Function! You've hit /test
```

ID トークンが Cognito にて認証され、Amazon API Gateway から Lambda 関数 が実行されます。
指定した URL のパスが表示されるのみのシンプルな API です。ID トークンを指定しない場合は、

```sh
(出力例)
$ curl -H GET 'https://openapi-base.apibase.example.com/test'

{"message":"Unauthorized"}
```

と認証エラーとなります。

以上でゲストアプリケーションでの参照系 API の確認は終了です。
