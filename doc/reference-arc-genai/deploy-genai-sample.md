# [生成 AI] ワークロード サンプルコードのデプロイ手順

[リポジトリの README に戻る](../../README.md)

ここでは BLEA for FSI のガバナンスベースがデプロイされたアカウントに [生成 AI] ワークロードのサンプルコードを導入する手順について記述します。

> `MC`はマネジメントコンソールでの作業を、`Local`は手元環境での作業を示します。

## 前提条件

- AWS CLI が設定されている
- Node.js 18 以上
- docker コマンドが利用できる

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

#### 2. GenU リポジトリのクローンとカスタマイズの適用

生成 AI ワークロードのサンプルコードは、AWS Samples で公開されている [GenU (Generative AI Use Cases)](https://github.com/aws-samples/generative-ai-use-cases) をベースに、金融機関向けにカスタマイズしたものです。以下の手順でカスタマイズ版を準備します。

作業ディレクトリに移動し、GenU リポジトリをクローンします。

```sh
cd /path/to/your/workspace
git clone https://github.com/aws-samples/generative-ai-use-cases.git
cd generative-ai-use-cases
```

特定のコミットにチェックアウトします。

```sh
git checkout ab083c504c69bae934eba5fb7f8cab33c5bb75ce
```

金融機関向けカスタマイズを適用します。

```sh
# BLEA for FSI リポジトリのパスを適宜変更してください
git apply /path/to/baseline-environment-on-aws-for-financial-services-institute/doc/reference-arc-genai/changes.diff
```

> NOTE:
>
> - このカスタマイズには、FISC 安全対策基準に準拠するための暗号化設定やセキュリティ強化が含まれています
> - 詳細なカスタマイズ内容については、`changes.diff` ファイルを参照してください

#### 3. 依存パッケージのインストールとビルド

GenU のセットアップを行います。

```sh
npm ci
```

#### 4. 生成 AI ワークロードをデプロイする

（ログインしていない場合）AWS IAM Identity Center（旧 AWS SSO) を使ってゲストアカウントにログインします。

```sh
aws sso login --profile ct-guest-sso
```

ゲストアカウントで CDK ブートストラップを実行します。

```sh
npx cdk bootstrap --profile ct-guest-sso --region ap-northeast-1
npx cdk bootstrap --profile ct-guest-sso --region us-east-1
```

サンプルコードをデプロイします。

```sh
npm -w packages/cdk run cdk deploy -- --all --require-approval never --profile ct-guest-sso
```

> NOTE:
>
> - `--all` オプションにより、必要なすべてのスタックが順次デプロイされます
> - デプロイ時に IAM ポリシーに関する変更確認をスキップするために `--require-approval never` オプションを指定しています
> - デプロイには 20〜30 分程度かかります

デプロイが完了すると、Output として以下の情報が表示されます。

```
Outputs:
ClosedNetworkStack-priv.WebUrl = http://internal-xxxxx.ap-northeast-1.elb.amazonaws.com
GenerativeAiUseCasesStack-priv.ApiEndpoint = https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
DashboardStack-priv.DashboardName = GenerativeAiUseCasesDashboard-xxxxx
DashboardStack-priv.LogGroupName = /aws/bedrock/modelinvocations
DashboardStack-priv.BedrockLogServiceRole = arn:aws:iam::123456789012:role/xxxxx
```

#### 5. Bedrock のモデル呼び出しログ設定を有効化する（MC）

デプロイ後、Amazon Bedrock のモデル呼び出しログを CloudWatch Logs に記録するための設定を行います。

1. AWS マネジメントコンソールにログインし、Amazon Bedrock のコンソールを開きます
2. 左側のメニューから「Settings」→「Model invocation logging」を選択します
3. 「Edit」ボタンをクリックします
4. 以下の設定を行います：
   - Log output location: 「CloudWatch Logs」を選択
   - CloudWatch Logs log group: DashboardStack の Output に表示された `LogGroupName` の値を入力（例: `/aws/bedrock/modelinvocations`）
   - IAM role: 「Use an existing service role」を選択し、DashboardStack の Output に表示された `BedrockLogServiceRole` の ARN を入力
   - Log all text: チェックを入れる
   - Log all images: チェックを入れる
   - Log all embeddings: チェックを入れる
5. 「Save changes」をクリックして設定を保存します

> NOTE:
>
> - この設定により、Bedrock のモデル呼び出しに関する詳細なログが CloudWatch Logs に記録されます
> - ログは暗号化された状態で保存され、1 年間保持されます
> - CloudWatch Dashboard から利用状況やトークン使用量を確認できます

#### 6. 動作確認

デプロイが完了したら、GenU にアクセスして動作確認を行います。

##### 6.1. 検証環境へのアクセス

閉域モードでデプロイされた GenU にアクセスするため、検証用の Windows インスタンスを使用します。

1. **EC2 Key Pair の Private Key の取得**

   Windows インスタンスに RDP で接続するために EC2 に設定した Key Pair の private key を取得します。private key を取得するためのコマンドは `WindowsRdpGetSSMKeyCommand...` で始まる ClosedNetworkStack の出力に表示されています。

   ```bash
   aws ssm get-parameter --name /ec2/keypair/key-aaaaaaaaaaaaaaaaa --region ap-northeast-1 --with-decryption --query Parameter.Value --output text --profile ct-guest-sso
   ```

   このコマンドを実行した結果をコピーしてください。

2. **Windows インスタンスに接続**

   1. マネジメントコンソールを開き、[EC2](https://console.aws.amazon.com/ec2/home) を開きます
   2. ClosedNetworkStack... から始まる名前のインスタンスにチェックを入れ、右上の「Connect」をクリックします
   3. タブで RDP client を選択し、Connect using Fleet manager を選択して Fleet Manager Remote Desktop をクリックします
   4. Authentication type は Key pair を選択し、Key pair content を Paste key pair content を選択して手順 1 で取得した private key を貼り付けます
   5. Connect をクリックします

3. **GenU にアクセス**

   Windows 内で Edge ブラウザを開き、ClosedNetworkStack の WebUrl 出力に表示される URL を入力して GenU にアクセスします。

   初回アクセス時は SignUp が必要です。以下の手順でユーザーを作成してください：

   1. 「Sign Up」をクリック
   2. メールアドレス、パスワードを入力してアカウントを作成
   3. 確認コードがメールで送信されるので、入力して認証を完了

##### 6.2. 基本機能の動作確認

GenU にログイン後、以下の機能を確認してください：

1. **チャット機能**

   - トップページから「Chat」を選択
   - テキストボックスに質問を入力して送信
   - AI からの応答が表示されることを確認

2. **画像生成機能**

   - 「Image Generation」を選択
   - プロンプトを入力して画像を生成
   - 生成された画像が表示されることを確認

3. **動画生成機能**

   - 「Video Generation」を選択
   - プロンプトを入力して動画を生成
   - 生成された動画が表示されることを確認

4. **ガードレール機能**
   - 不適切なコンテンツ（個人情報、機密情報など）を含む質問を入力
   - ガードレールによってブロックされることを確認
   - ブロックメッセージが表示されることを確認

> NOTE:
>
> - 検証インスタンスは自動停止しないため、検証が完了したら EC2 を開いて対象インスタンスを手動で停止してください
> - 検証環境そのものが不要であれば、`closedNetworkCreateTestEnvironment` を false にして再デプロイすることで削除可能です

#### 7. (オプション) CloudWatch Dashboard での監視

デプロイ時に作成された CloudWatch Dashboard を使用して、GenU の利用状況を監視できます。

1. AWS マネジメントコンソールで CloudWatch を開きます
2. 左側のメニューから「Dashboards」を選択
3. DashboardStack の Output に表示された `DashboardName` のダッシュボードを開きます
4. 以下のメトリクスを確認できます：
   - モデルごとの入力トークン数
   - モデルごとの出力トークン数
   - モデル呼び出し回数
   - サインイン数
   - プロンプトログ

## トラブルシューティング

### デプロイ時のエラー

- **CDK ブートストラップエラー**: AWS CLI プロファイルが正しく設定されているか確認してください
- **リソース作成エラー**: IAM 権限が不足している可能性があります。AWSAdministratorAccess ロールでログインしているか確認してください

### アクセス時のエラー

- **GenU にアクセスできない**: ClosedNetworkStack の WebUrl が正しいか確認してください。また、検証用 Windows インスタンスから接続していることを確認してください
- **サインアップできない**: メールアドレスの形式が正しいか、パスワードが要件を満たしているか確認してください

## 参考資料

- [GenU 公式ドキュメント](https://github.com/aws-samples/generative-ai-use-cases)
- [GenU 閉域モードドキュメント](https://github.com/aws-samples/generative-ai-use-cases/blob/main/docs/ja/CLOSED_NETWORK.md)
- [Amazon Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)
