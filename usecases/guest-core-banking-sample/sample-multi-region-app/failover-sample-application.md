# マルチリージョン対応 マイクロサービス サンプルアプリケーションのフェイルオーバー手順

マルチリージョン マイクロサービス・アプリケーションを東京リージョンから大阪リージョンにフェイルオーバーおよびフェイルバックするための手順を示します。

## 1. Locust でサンプルアプリケーションにリクエストを送る

ドメイン `api.example.com` をターゲットに Locust でリクエストを送ります。
別のリクエストを送信している場合は [Stop]ボタンを押して、リクエストを止めます。右上にある[New test]リンクを押すことで、新しい設定でリクエストを送ることができます。

Locust の設定画面で下記を入力します。

| 項目                           | 値                     |
| ------------------------------ | ---------------------- |
| Number of Users(User 数)       | 10                     |
| Spawn rate(秒間当たりの実行数) | 1                      |
| Host                           | http://api.example.com |

![](imgs/locust-006.png)

[Satrt Swarming]ボタンを押して、Locust で負荷を発生させます。エラーが発生しないことを確認して下さい。

## 2． 疑似障害発生と検知

### 2-1. ALB の IP アドレスの確認

事前準備として、東京リージョンの ALB に割り当てられた IP アドレスを確認します。
下記のコマンドを実行して SSM セッションマネージャー経由でデモクライアント用 EC2 bastion host にアクセスします。

> コマンドを実行する前に、下記のドキュメントに従って CLI からセッションマネージャー機能を利用するために必要となる Session Manager プラグインのインストールを行って下さい。  
> https://docs.aws.amazon.com/ja_jp/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html

```sh
aws ssm start-session --target <EC2インスタンスID> --profile ct-guest-sso
```

> <EC2 インスタンス ID>は確認した bastion host のインスタンス ID に置き換えて下さい 例 i-0xxxx

dig コマンドを実行して、ALB に割り当てられた 2 つの IP アドレスを確認します。

```
dig api.example.com
```

結果の例（10.100.5.165 と 10.100.9.84 が割り当てられた IP アドレス）:

```
; <<>> DiG 9.11.4-P2-RedHat-9.11.4-26.P2.amzn2.13 <<>> api.example.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 55699
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;api.example.com.               IN      A

;; ANSWER SECTION:
api.example.com.        60      IN      A       10.100.5.165
api.example.com.        60      IN      A       10.100.9.84

;; Query time: 2 msec
```

### 2-2. AWS Fault Injection Simulator(FIS) による疑似障害の注入

オンプレミスから東京リージョンへのネットワーク全経路上での断続的なパケットロス発生を想定した疑似障害を FIS で注入します。
ここでは、FIS アクション`AWSFIS-Run-Network-Packet-Loss-Sources`を使用して Trx シミュレータの EC2 にてパケットロスを発生させます。

[手順]

- マネジメントコンソールから東京リージョンの FIS にアクセス

  - `実験テンプレート`を作成

    - 説明: 東京リージョンでパケットロスを発生
    - 名前：exp-packetloss
    - アクション

      - 名前: Run-Network-Packet-Loss
      - アクションタイプ: SSM aws:ssm:send-command
      - ターゲット: Instances-Target-1
      - Document ARN: arn:aws:ssm:ap-northeast-1::document/AWSFIS-Run-Network-Packet-Loss-Sources
      - Document Parameters:

      ```
      {"LossPercent":"30", "Sources":"<手順2−1で確認したIPアドレス>", "TrafficType":"ingress", "DurationSeconds":"1800", "InstallDependencies":"True"}
      ```

      > Document Parameter に指定する <手順 2−1 で確認した IP アドレス>は、カンマ区切りで 2 つ記載して下さい。
      > 例 10.100.10.112,10.100.5.212

      - Duration: 30 分

    - ターゲット
      - `Instance-Target-1` で Target Method を指定
        - リソースタイプ: aws:ec2:instance
        - リソース ID として BastionHost を選択
    - 停止条件
      - ブランク（指定しない）
    - サービスアクセス
      - `実験テンプレート用の新しいロールを作成する `を選択

  <img src="./imgs/fis-001.png" width="50%">

- [実験を開始] をクリックして`実験`を開始する

- Locust(負荷ツール）の画面をチェックして、レスポンスタイムやエラーカウントの上昇などから注入したパケットロスによりネットワーク接続が不安定になっていることを確認する。

  > FIS の SSM パラメータでのパケットロス率（今回は 30%で指定）や Locust からのリクエスト数を増やすことで、障害の影響を大きくすることができます。

  <img src="./imgs/fis-002.png" width="50%">

## 3． Step Functions による大阪リージョンへのフェイルオーバー

東京リージョンから大阪リージョンへアプリケーションをフェイルオーバーするためのステートマシンを大阪リージョンで実行します。このワークフローにより以下が実行されます。

- 東京リージョンの DynamoDB でアプリケーション閉塞フラグを TRUE に変更してアプリケーションを閉塞（クライアントからのリクエストをつけ付けない状態）させます。
- Route53 Application Recovery Controller(ARC) を使用してユーザリクエストを大阪リージョンの ALB へルーティングさせます。
- Aurora の Switchover を実施し、Aurora グローバルクラスタを東京リージョンから大阪リージョンへ切り替えます。
- 大阪リージョンの DynamoDB でアプリケーション閉塞フラグを FALSE に変更してアプリケーションを開放（クライアントからのリクエストをつけ付ける状態）します。

  ```shell
  aws stepfunctions start-execution --state-machine-arn <ステートマシンのARN> --region ap-northeast-3 --profile ct-guest-sso
  ```

<ステートマシンの ARN>の部分には大阪リージョンの Stepfunctions にて”FailoverStateMachine”で始まるステートマシンを見つけてその ARN を使用してください。

## 4． Step Functions による東京リージョンへのフェイルバック

大阪リージョンから東京リージョンへアプリケーションをフェイルバックするためのステートマシンを実行します。このワークフローにより以下が実行されます。

- 大阪リージョンの DynamoDB でアプリケーション閉塞フラグを TRUE に変更しアプリケーションを閉塞（クライアントからのリクエストをつけ付けない状態）させます。
- Route53 Application Recovery Controller(ARC) を使用してユーザリクエストを東京リージョンの ALB へルーティングさせます。
- Aurora の Switchover を実施し、Aurora グローバルクラスタを大阪リージョンから東京リージョンへ切り替えます。
- 東京リージョンの DynamoDB でアプリケーション閉塞フラグを FALSE に変更してアプリケーションを開放（クライアントからのリクエストをつけ付ける状態）します。

  ```shell
  aws stepfunctions start-execution --state-machine-arn <ステートマシンのARN> --region ap-northeast-3 --profile ct-guest-sso
  ```

<ステートマシンの ARN>の部分には大阪リージョンの Stepfunctions にて”FailbackStateMachine”で始まるステートマシンを見つけてその ARN を使用してください。
