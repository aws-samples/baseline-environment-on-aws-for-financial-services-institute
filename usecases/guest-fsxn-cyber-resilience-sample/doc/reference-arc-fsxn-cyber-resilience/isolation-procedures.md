# 自動ネットワーク隔離手順書 [FSxN サイバーレジリエンス]

## 概要

GuardDuty が HIGH/CRITICAL の脅威を検知した場合、EventBridge → Lambda により自動的にネットワークを遮断します。

## 隔離フロー

```
GuardDuty Finding (HIGH/CRITICAL)
    ↓
EventBridge Rule (フィルタ: severity >= 7)
    ↓
Lambda (NetworkIsolation)
    ↓
NACL deny-all ルール追加
    ↓
SNS 通知 → メール / Slack
    ↓
CloudWatch Logs (incident_id 記録)
```

## 自動隔離の動作

### トリガー条件

- GuardDuty の Finding で `severity >= 7.0` (HIGH or CRITICAL)
- 対象: VPC 内のすべてのネットワーク通信

### 実行内容

Lambda が以下を実行：

1. VPC の NACL を取得
2. deny-all inbound/outbound ルール（rule number: 1）を追加
3. incident_id を生成しログに記録
4. SNS トピックに通知を発行

### 隔離後の状態

- FSxN への NFS/SMB アクセス: **不可**
- VPC Endpoint 経由の AWS API: **不可**
- 管理者の SSH/SSM アクセス: **不可**
- **完全なネットワーク分離状態**

## 隔離解除手順

> ⚠️ 隔離解除は脅威の分析・対処が完了した後にのみ実行してください

### Step 1: 脅威の分析

```bash
# GuardDuty Finding 詳細確認
aws guardduty list-findings \
  --detector-id <detector-id> \
  --finding-criteria '{"Criterion":{"severity":{"Gte":7}}}'

aws guardduty get-findings \
  --detector-id <detector-id> \
  --finding-ids <finding-id>
```

### Step 2: 隔離解除（NACL ルール削除）

```bash
# NACL ID を確認
NACL_ID=$(aws ec2 describe-network-acls \
  --filters Name=vpc-id,Values=<vpc-id> \
  --query 'NetworkAcls[0].NetworkAclId' --output text)

# deny-all ルールを削除（inbound + outbound）
aws ec2 delete-network-acl-entry \
  --network-acl-id $NACL_ID \
  --rule-number 1 --ingress

aws ec2 delete-network-acl-entry \
  --network-acl-id $NACL_ID \
  --rule-number 1 --egress
```

### Step 3: 接続確認

```bash
# FSxN アクセス確認
aws fsx describe-file-systems \
  --query 'FileSystems[?FileSystemId==`<fs-id>`].Lifecycle'

# NFS マウントテスト（EC2 から）
mount -t nfs -o nfsvers=4.1 <endpoint>:/production /mnt/test
```

## インシデント対応フロー

| ステップ    | 担当               | 内容                          | 所要時間  |
| ----------- | ------------------ | ----------------------------- | --------- |
| 1. 検知     | 自動               | GuardDuty → 自動隔離          | 即時      |
| 2. 通知     | 自動               | SNS → メール/Slack            | < 1 分    |
| 3. 初動     | セキュリティチーム | Finding 分析、影響範囲特定    | < 30 分   |
| 4. 封じ込め | セキュリティチーム | 侵害アカウント/リソースの特定 | < 2 時間  |
| 5. 復旧判断 | CISO/責任者        | 隔離解除 or 復旧開始          | 判断次第  |
| 6. 復旧     | インフラチーム     | `restore-procedures.md` 参照  | < 4 時間  |
| 7. 事後分析 | 全チーム           | インシデントレポート作成      | < 24 時間 |

## テスト方法

### GuardDuty サンプル Finding でテスト

```bash
# サンプル Finding を生成（実害なし）
aws guardduty create-sample-findings \
  --detector-id <detector-id> \
  --finding-types "UnauthorizedAccess:EC2/MaliciousIPCaller.Custom"
```

> ⚠️ サンプル Finding は自動隔離をトリガーします。テスト環境でのみ実行してください。

### Lambda ログ確認

```bash
aws logs filter-log-events \
  --log-group-name <isolation-log-group> \
  --filter-pattern "incident_id" \
  --query 'events[*].message'
```

## 注意事項

- 自動隔離は **誤検知でも実行** されます。GuardDuty の Findings を定期的にレビューし、不要なアラートは抑制してください
- 隔離中は FSxN へのアクセスが完全に遮断されるため、業務影響が発生します
- 本番環境では隔離解除を自動化せず、必ず人的判断を介在させてください
