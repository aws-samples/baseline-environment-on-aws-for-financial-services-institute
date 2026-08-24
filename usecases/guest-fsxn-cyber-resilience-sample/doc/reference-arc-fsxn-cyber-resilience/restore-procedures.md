# 復旧手順書 [FSxN サイバーレジリエンス]

## 復旧方針

| 障害レベル           | RTO 目標 | 復旧元                | 手順           |
| -------------------- | -------- | --------------------- | -------------- |
| ファイル単位の復旧   | < 5 分   | TPS / 通常 Snapshot   | 手順 A         |
| ボリューム単位の復旧 | < 30 分  | AWS Backup (ローカル) | 手順 B         |
| ランサムウェア被害   | < 4 時間 | Air-gapped Vault      | 手順 C（自動） |
| 災害復旧（DR）       | < 4 時間 | Air-gapped Vault      | 手順 C（自動） |

## 手順 A: ファイル単位の復旧（Snapshot から）

```bash
# 1. 利用可能な Snapshot 一覧を確認
# ONTAP CLI:
# > volume snapshot show -volume vol_production

# 2. Snapshot からファイルをコピー（NFS クライアントから）
cp /mnt/fsxn/.snapshot/<snapshot-name>/<file-path> /mnt/fsxn/<restore-path>
```

## 手順 B: ボリューム単位の復旧（AWS Backup から）

```bash
# 1. 復旧ポイント一覧
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name <vault-name> \
  --by-resource-type FSx \
  --max-results 10

# 2. リストア実行
aws backup start-restore-job \
  --recovery-point-arn <recovery-point-arn> \
  --iam-role-arn <restore-role-arn> \
  --metadata '{"FileSystemId":"<fs-id>","FileSystemType":"ONTAP"}'
```

## 手順 C: ランサムウェア被害からの復旧（自動ワークフロー）

StepFunctions ワークフローが自動実行されます。手動トリガーも可能：

```bash
# リストアアカウントで実行
aws stepfunctions start-execution \
  --state-machine-arn <state-machine-arn> \
  --input '{"recoveryPointArn":"<arn>","targetFileSystemId":"<fs-id>"}'
```

### 自動ワークフローの流れ

1. **バックアップ特定**: Air-gapped Vault から最新の正常な復旧ポイントを検索
2. **リストア実行**: 新しいボリュームとして復元
3. **整合性検証**: 基本的なファイルシステムチェック
4. **通知**: SNS 経由で完了/失敗を通知
5. **切り替え**: 手動で junction path を切り替え

### 復旧後の確認

```bash
# FSxN ボリューム状態確認
aws fsx describe-volumes \
  --volume-ids <restored-volume-id> \
  --query 'Volumes[0].Lifecycle'

# NFS マウントテスト
mount -t nfs -o nfsvers=4.1 <svm-endpoint>:/<junction-path> /mnt/restored
ls -la /mnt/restored
```

## 復旧訓練

四半期に 1 回、以下の訓練を実施することを推奨：

1. テスト環境に `cdk deploy` で同一構成をデプロイ
2. テストデータを投入
3. 手動で Backup ジョブを実行
4. 手順 B または C で復旧を実行
5. 復旧データの整合性を確認
6. 訓練記録を作成
7. テスト環境をクリーンアップ
