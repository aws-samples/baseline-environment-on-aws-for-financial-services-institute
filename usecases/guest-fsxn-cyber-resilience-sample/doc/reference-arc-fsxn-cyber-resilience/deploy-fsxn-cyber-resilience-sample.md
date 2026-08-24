# CDK サンプルコード デプロイ手順 [FSxN サイバーレジリエンス]

## 前提条件

- AWS CDK CLI >= 2.236.0
- Node.js >= 20.x
- 3 つの AWS アカウント（ワークロード / データバンカー / リストア）
- AWS CLI 認証情報（各アカウントの profile 設定済み）
- CDK Bootstrap 実施済み（各アカウント）

## 事前準備

### 1. Secrets Manager に FSxN 管理パスワードを登録

ワークロードアカウントで実行:

```bash
aws secretsmanager create-secret \
  --name fsxn-cyber-resilience-admin \
  --secret-string '{"password":"YOUR_FSXADMIN_PASSWORD"}' \
  --region ap-northeast-1
```

> ⚠️ パスワードは十分な強度を確保してください（英大小文字 + 数字 + 特殊文字、12 文字以上推奨）

### 2. parameter.ts の設定

`parameter.ts` を編集し、各環境に合わせた値を設定します:

```typescript
export const devParameter: AppParameter = {
  envName: 'Development',
  // 作成したシークレットの ARN を設定
  ontapSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:<ACCOUNT_ID>:secret:<SECRET_NAME>',
  // 各アカウント ID を設定
  env: { account: '<WORKLOAD_ACCOUNT_ID>', region: 'ap-northeast-1' },
  dataBankerAccountId: '<DATA_BANKER_ACCOUNT_ID>',
  restoreAccountId: '<RESTORE_ACCOUNT_ID>',
  // ... 他のパラメータ
};
```

## デプロイ手順

### デプロイ順序（重要）

3 つのスタックは以下の順序でデプロイしてください：

```
1. Data Banker → 2. Workload → 3. Restore
```

### Step 1: 依存パッケージインストール

```bash
cd usecases/guest-fsxn-cyber-resilience-sample
npm ci
```

### Step 2: ビルド・テスト確認

```bash
npx tsc --noEmit          # コンパイル確認
npx jest --no-coverage    # 13 テスト通過確認
npx cdk synth             # 3 スタック合成確認
```

### Step 3: Data Banker アカウントにデプロイ

```bash
npx cdk deploy Dev-FSxNCyberResilience-DataBanker \
  --profile data-banker \
  --require-approval never
```

デプロイ完了後、Vault ARN を確認:

```bash
aws backup describe-backup-vault \
  --backup-vault-name <vault-name> \
  --profile data-banker \
  --query 'BackupVaultArn' --output text
```

### Step 4: Workload アカウントにデプロイ

> ⚠️ `parameter.ts` の `dataBankerVaultArn` に Step 3 で取得した ARN を設定してください

```bash
npx cdk deploy Dev-FSxNCyberResilience-Workload \
  --profile workload \
  --require-approval never
```

デプロイ時間: 約 25-35 分（FSxN 作成に時間がかかります）

### Step 5: Restore アカウントにデプロイ

```bash
npx cdk deploy Dev-FSxNCyberResilience-Restore \
  --profile restore \
  --require-approval never
```

### Step 6: SnapVault 有効化（オプション）

FSxN が完全に AVAILABLE になった後、SnapVault レプリケーションを有効化:

```bash
# parameter.ts を編集
# enableSnapVault: true に変更

npx cdk deploy Dev-FSxNCyberResilience-Workload \
  --profile workload \
  --require-approval never
```

### Step 7: ARP learning → active 遷移（30 日後）

ARP は 30 日間の学習期間後に手動で active モードに遷移します:

```bash
# ONTAP REST API 経由
curl -X PATCH "https://management.<fs-id>.fsx.<region>.amazonaws.com/api/storage/volumes/<vol-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"anti_ransomware": {"state": "active"}}' \
  -u "fsxadmin:<password>" -k
```

## デプロイ後の確認

### 基本確認

```bash
# スタック状態確認
aws cloudformation describe-stacks \
  --stack-name Dev-FSxNCyberResilience-Workload \
  --query 'Stacks[0].StackStatus'

# FSxN 状態確認
aws fsx describe-file-systems \
  --query 'FileSystems[?Tags[?Value==`Dev-FSxNCyberResilience-Workload`]].[FileSystemId,Lifecycle]'

# アラーム状態確認
aws cloudwatch describe-alarms \
  --alarm-name-prefix "Dev-FSxNCyberResilience" \
  --query 'MetricAlarms[*].[AlarmName,StateValue]'
```

### TPS 確認

Lambda ログで TPS 設定成功を確認:

```bash
aws logs filter-log-events \
  --log-group-name <log-group-name> \
  --filter-pattern "ontap_cr_success" \
  --query 'events[*].message'
```

### ネットワーク隔離テスト

GuardDuty のテストイベントで隔離 Lambda が動作することを確認:

```bash
aws guardduty create-sample-findings \
  --detector-id <detector-id> \
  --finding-types "Recon:EC2/PortProbeUnprotectedPort"
```

## クリーンアップ

```bash
# クリーンアップスクリプト使用（推奨）
bash shared/scripts/cleanup-fsxn-stack.sh Dev-FSxNCyberResilience-Workload ap-northeast-1

# 個別削除（手動）
npx cdk destroy Dev-FSxNCyberResilience-Restore --profile restore
npx cdk destroy Dev-FSxNCyberResilience-Workload --profile workload
npx cdk destroy Dev-FSxNCyberResilience-DataBanker --profile data-banker
```

> ⚠️ FSxN は `RemovalPolicy.RETAIN` のため `cdk destroy` では削除されません。手動削除が必要です。

## トラブルシューティング

| 症状                            | 原因                              | 対処                                                      |
| ------------------------------- | --------------------------------- | --------------------------------------------------------- |
| SnapLock Volume 作成失敗        | `StorageEfficiencyEnabled` 未設定 | CDK コードを確認（自動設定済み）                          |
| SnapVault Lambda `fetch failed` | 管理エンドポイント DNS 未解決     | `enableSnapVault: false` で初回デプロイ後、2 回目で有効化 |
| SVM 削除失敗（ROLLBACK 時）     | RETAIN ボリュームが存在           | 手動で Volume → SVM → FS の順に削除                       |
| Backup Vault 名前衝突           | 前回のデプロイ残骸                | Vault を手動削除してからリデプロイ                        |
