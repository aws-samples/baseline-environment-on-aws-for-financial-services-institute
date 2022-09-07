# BLEA for FSI 導入の前提条件

### 導入クライアント環境

BLEA for FSI の AWS アカウントへの導入は CDK（Cloud Development Kit）を利用して行うためインターネットに接続できるクライアント環境（Windows/Linux/Mac）が必要になります。

#### 閉域網での CDK 実行環境

自社のセキュリティ統制のルールにより AWS アカウントに接続可能なクライアントからインターネットに接続できないケースでは、CloudFormation テンプレートを利用して AWS アカウント上に「閉域網での CDK 実行環境」を作るオプションを準備していますので、下記手順を参照して環境を準備して下さい。

- [手順]: [閉域網での CDK 実行環境 のセットアップ手順](./cdk-deployment-environment-setup.md)

### 導入クライアントの前提条件

#### a. ランタイム

以下のランタイムを使用します。各 OS ごとの手順に従いインストールしてください。

- [Node.js](https://nodejs.org/) (>= `14.0.0`)
  - `npm` (>= `8.1.0`)
- [Git](https://git-scm.com/)
- [CDK](https://github.com/aws/aws-cdk)(>= `v2.18.0`)

npm は workspaces を使用するため 8.1.0 以上が必要です。最新バージョンは以下のようにしてインストールしてください。

```sh
npm install -g npm
```

クライアントでデプロイだけを行う場合、git 環境のセットアップは必ずしも必要ありません。クライアントへの導入資材のコピーの別の手段で行って下さい（zip で固めてコピーする等）。

- AWS IAM Identity Center（旧 AWS SSO) を使うための前提条件
  - AWS IAM Identity Center との連携のため [AWS CLI version2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)が必要です。

#### b. 開発環境

CDK テンプレートをデプロイする環境では開発環境をセットアップする必要はありません。CDK テンプレートをカスタマイズする環境では、CDK コードを安全に編集するため以下の手順に沿った Visual Studio Code に使った開発環境のセットアップを推奨します。

- [手順]: [Visual Studio Code のセットアップ手順](how-to.md#visual-studio-code-のセットアップ)
