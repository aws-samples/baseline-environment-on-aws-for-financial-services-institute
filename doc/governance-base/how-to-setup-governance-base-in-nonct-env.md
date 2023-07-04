# シングルアカウント／非 Control Tower 環境でのガバナンスベースのセットアップ方法

BLEA for FSI は AWS Control Tower にょるマルチアカウント環境を前提に構成されていますが、ここではシングルアカウントや非 Control Tower 環境のアカウントにガバナンスベースと同等の統制機能をセットアップする方法を説明します。

> **Note**  
> 各金融ワークロード サンプルアプリケーションは Control Tower 環境を前提にしていないため、非 Control Tower 環境で動かすために特別な対応は必要ありません。

BLEA for FSI ガバナンスベースは下記の機能から構成されています。

| #   | 機能                                                       | 実現方法（AWS サービス/CDK)                                                                                         |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | セキュリティ関連 AWS サービスの有効化                      | AWS CloudTrail<br>AWS Config<br>AWS Security Hub<br>AWS GuardDuty<br>AWS IAM Access Analyzer<br>AWS Trusted Advisor |
| 2   | ログ集約                                                   | Control Tower                                                                                                       |
| 3   | Control Tower コントロール（旧ガードレール）               | Control Tower                                                                                                       |
| 4   | セキュリティアラート                                       | CDK                                                                                                                 |
| 5   | ユーザーの多要素認証                                       | IAM Identity Center                                                                                                 |
| 6   | IAM ポリシー/ロール、IAM グループの準備                    | CDK                                                                                                                 |
| 7   | （オプション）<br>CloudTrail データイベントの有効化        | CDK                                                                                                                 |
| 8   | （オプション）<br>SSM セッションマネージャーの監査ログ取得 | CDK                                                                                                                 |

以下、各機能について非 Control Tower 環境下でのセットアップ方法について説明していきます。

### 1. セキュリティ関連 AWS サービスの有効化

セキュリティ関連の下記の AWS サービスを手作業で有効化して下さい。

- AWS CloudTrail
- AWS Config
- AWS Security Hub
- AWS GuardDuty
- AWS IAM Access Analyzer
- AWS Trusted Advisor（オプション）

> 参考: [AWS Control Tower およびセキュリティサービスのセットアップ](../doc/deploy-governance-base.md#1-1-aws-control-tower-%E3%81%AE%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97)

### 2. ログの集約

AWS CloudTrail、AWS Config のログは各アカウントごとに個別に保管するのではなく、ログ集約アカウント（Control Tower 環境下では Log Archive アカウント）上の S3 バケットに集約して保管します。Control Tower 使用時は各ゲストアカウントに対して自動的に AWS CloudTrail、AWS Config の有効化および集約ログの設定を行いますので、非 Control Tower 環境下ではユーザー側で実施する必要があります。

> **Note**  
> CloudTrail 用の CloudWatch Logs ロググループは、集約アカウントではなく各アカウント個別に準備しています。これは BLEA for FSI ではゲストアカウントのログ監視はゲストアカウント側の管理者が実施すべきと考えるためです。

> 参考: [AWS Control Tower Landing Zone ver3.0 のアップデートに関する注意事項](../update-for-landigzon30.md)

ガバナンスベースの CDK スタック中で、下記の コンストラクトを実行することで、CloudTrail 用の CloudWatch Logs ロググループをゲストアカウント上に作成できます。

> **CDK costruct ファイル:**  
> usecases/base-ct-guest/lib/cloudtrail-trail.ts

### 3. Control Tower コントロール（旧ガードレール）

Control Tower はコントロールとしてアカウントの統制機能（予防的統制/発見的統制）を提供しています。これらのコントロールは内部的には SCP、Config ルール を利用して実現しているため、ユーザー側で同等の SCP または Config ルールを準備することで、Control Tower 相当のコントロールを各アカウント上に準備することができます。

BLEA for FSI で適用を推奨しているコントロールに対する Config ルールの対応は以下を参照して下さい。

> 参考: [FISC 安全対策基準 実務基準と Control Tower ガードレールでの対策](../fiscmapping-ct-guardrails.md)

| マネージドルール識別子                                                                                                                             | 対象リソース   | ルール内容                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [ROOT_ACCOUNT_MFA_ENABLED](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/root-account-mfa-enabled.html)                           | ROOT ユーザ    | ROOT ユーザーに対して MFA が有効化されていることを確認                                                                                     |
| [IAM_ROOT_ACCESS_KEY_CHECK](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/iam-root-access-key-check.html)                         | ROOT ユーザ    | ROOT ユーザーに対してアクセスキーが作成されていないことを確認                                                                              |
| [IAM_USER_MFA_ENABLED](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/iam-user-mfa-enabled.html)                                   | IAM ユーザ     | IAM ユーザーの MFA が有効になっていることを確認                                                                                            |
| [MFA_ENABLED_FOR_IAM_CONSOLE_ACCESS](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/mfa-enabled-for-iam-console-access.html)       | IAM ユーザ     | コンソールにアクセスする IAM ユーザーの MFA が有効になっていることを確認                                                                   |
| [S3_BUCKET_PUBLIC_READ_PROHIBITED](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/s3-bucket-public-read-prohibited.html)           | S3             | S3 バケットでパブリック読み取りアクセスが許可されていないことを確認                                                                        |
| [S3_BUCKET_PUBLIC_WRITE_PROHIBITED](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/s3-bucket-public-write-prohibited.html)         | S3             | S3 バケットでパブリック書き込みアクセスが許可されていないことを確認                                                                        |
| [S3_ACCOUNT_LEVEL_PUBLIC_ACCESS_BLOCKS](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/s3-account-level-public-access-blocks.html) | S3             | S3 に対するパブリックアクセスブロック設定がアカウントレベルから設定されていることを確認                                                    |
| [EC2_VOLUME_INUSE_CHECK](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/ec2-volume-inuse-check.html)                               | EBS            | EBS ボリュームが EC2 にアタッチされていることを確認                                                                                        |
| [EBS_OPTIMIZED_INSTANCE](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/ebs-optimized-instance.html)                               | EBS            | EBS 最適化できる EC2 インスタンスに対して EBS 最適化が有効になっていることを確認                                                           |
| [ENCRYPTED_VOLUMES](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/encrypted-volumes.html)                                         | EBS            | EC2 インスタンスにアタッチされた EBS ボリュームが暗号化されていることを確認                                                                |
| [EC2_EBS_ENCRYPTION_BY_DEFAULT](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/ec2-ebs-encryption-by-default.html)                 | EBS            | EBS ボリュームの暗号化がデフォルトで有効になっていることを確認                                                                             |
| [RDS_INSTANCE_PUBLIC_ACCESS_CHECK](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/rds-instance-public-access-check.html)           | RDS            | RDS インスタンスに対してパブリックアクセスが可能になっていない（publiclyAccessible フィールドが false）ことを確認                          |
| [RDS_SNAPSHOTS_PUBLIC_PROHIBITED](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/rds-snapshots-public-prohibited.html)             | RDS            | RDS のスナップショットがパブリックでない事を確認                                                                                           |
| [RDS](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/rds-storage-encrypted.html)                                                   | RDS            | RDS DB インスタンスに対してストレージの暗号化が有効になっていることを確認                                                                  |
| [RESTRICTED_INCOMING_TRAFFIC](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/restricted-common-ports.html)                         | Security Group | 使用中の Security Group が特定のポートに対して無制限のインバウンド通信を許可していない事を確認<br>[対象ポート]<br>20, 21, 3389, 3306, 4333 |
| [INCOMING_SSH_DISABLED](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/restricted-ssh.html)                                        | Security Group | Security Group に対して無制限の SSH アクセスが許可されていないことを確認                                                                   |

### 4. セキュリティアラートの定義

BLEA for FSI では CloudWatch メトリクスフィルターによるアラーム、および EventBridge ルールを使用して、下記のセキュリティアラート（SNS トピックによるメール配信）を設定しています。

| #   | セキュリティアラートの内容                         | ソース           | タイプ                          |
| --- | -------------------------------------------------- | ---------------- | ------------------------------- |
| 1   | IAM インラインポリシーの削除                       | CloudTrail 証跡  | CloudWatch メトリクスフィルター |
| 2   | 複数回数の権限のない操作またはログイン失敗         | CloudTrail 証跡  | CloudWatch メトリクスフィルター |
| 3   | IAM ユーザーへのアクセスキーの作成                 | CloudTrail 証跡  | CloudWatch メトリクスフィルター |
| 4   | ROOT ユーザーでの直接操作                          | CloudTrail 証跡  | CloudWatch メトリクスフィルター |
| 5   | AWS Config ルールの違反                            | AWS Config       | EventBridge ルール              |
| 6   | AWS Health のイベント通知                          | AWS Health       | EventBridge ルール              |
| 7   | Security Group への変更                            | EC2              | EventBridge ルール              |
| 8   | Network ACL への変更                               | EC2              | EventBridge ルール              |
| 9   | CloudTrail 証跡への変更                            | AWS CloudTrail   | EventBridge ルール              |
| 10  | Security Hub での Critical/High の検出（Findings） | AWS Security Hub | EventBridge ルール              |
| 11  | GuardDuty での検出（Findings）                     | AWS GuardDuty    | EventBridge ルール              |

ガバナンスベースの CDK スタックでは、下記のコンストラクトを実行してゲストアカウント上に上記のセキュリティアラート定義と配信用の SNS トピックを作成できます。

> **CDK construct ファイル:**  
> usecases/base-ct-guest/lib/security-alarm.ts

また、次の自動修復設定を持つ Config ルールを設定しています。

| Config マネージドルールの識別子                                                                                                            | ルール内容                                                                                  | 自動修復の内容                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [VPC_DEFAULT_SECURITY_GROUP_CLOSED](https://docs.aws.amazon.com/ja_jp/config/latest/developerguide/vpc-default-security-group-closed.html) | デフォルトの Security Group では全てのインバウンド/アウトバウンド通信が許可されていないこと | [対象 Security Group の全てのルールを削除](https://docs.aws.amazon.com/systems-manager-automation-runbooks/latest/userguide/automation-aws-remove-default-secg-rules.html) |

ガバナンスベースの CDK スタックでは、下記のコンストラクトを実行して上記の Config ルールを作成できます。

> **CDK construct ファイル:**  
> usecases/base-ct-guest/lib/security-auto-remediation.ts

### 5. IAM ポリシー/ロール、IAM グループの準備

必要に応じて、IAM ポリシー/ロールおよび IAM グループをゲストアカウントに準備します。BLEA for FSI ガバナンスベースでは以下の 4 種類の IAM ポリシー/ロール および そのポリシーを割り当てた IAM グループを作成しています。

- SysAdmin システム管理者
- IamAdmin IAM 権限のみを持つ管理者
- ReadOnlyAdmin 参照権限のみを持つ管理者
- InstanceOps EC2 周りの権限のみを持つ管理者

ガバナンスベースの CDK スタックでは、下記のコンストラクトを実行して上記のリソースをセットアップできます。

> **CDK construct ファイル:**  
> usecases/base-ct-guest/lib/iam-sample.ts

### 6. CloudTrail データイベントの有効化（オプション）

Control Tower で自動的に有効化される CloudTrail 証跡は管理イベントに対してのみであり、S3 バケットアクセスのようなデータイベントに関しては別途有効化する必要があります。データイベントの CloudTrail 証跡ログも集約ログに保管するようにして下さい。

ガバナンスベースでは、下記の CDK スタックを実行してログ集約用のアカウントにデータイベント用の CloudTrail 証跡を作成できます。

> **CDK stack ファイル:**  
>  usecases/base-ct-logging/lib/bleafsi-base-st-logging-stack.ts

また下記のコンストラクトを実行して、ログ集約用に作成した S3 バケットに紐付けてゲストアカウントのデータイベント用の CloudTrail 証跡を作成できます。

> **CDK construct ファイル:**  
>  usecases/base-ct-guest/lib/cloudtrail-dataevent.ts

> 参考: [CloudTrail による S3 データイベントの記録](../deploy-governance-base.md#d-cloudtrail-による-s3-データイベントの記録)

### 7. SSM セッションマネージャーの監査ログ取得（オプション）

SSM セッションマネージャー使用時のセッションログの記録を有効化します。

ガバナンスベースの CDK スタックでは、下記のコンストラクトを実行してセッションログ保管用の S3 バケットを作成でき、このバケットがをセッションマネージャーの設定でログ保管先のバケットとして指定します。

> **CDK construct ファイル:**  
>  usecases/base-ct-guest/lib/session-manager-log.ts

> 参考: [SSM セッションマネージャーの S3 ログ出力を手動でセットアップする](../deploy-governance-base.md#7-5-オプション-ssm-セッションマネージャーの-s3-ログ出力を手動でセットアップするmc)
