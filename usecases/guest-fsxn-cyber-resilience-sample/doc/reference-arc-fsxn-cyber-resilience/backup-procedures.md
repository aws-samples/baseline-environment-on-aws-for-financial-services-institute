# バックアップ手順書 [FSxN サイバーレジリエンス]

## バックアップ体系

本アーキテクチャのバックアップは 4 層で構成されます：

| 層 | 方式 | 保護レベル | 保持期間 | 自動/手動 |
|---|------|----------|---------|----------|
| 1 | Tamperproof Snapshot | 管理者削除不可 | 7-14日 | 自動（ONTAP スケジュール） |
| 2 | SnapLock WORM | 物理的に変更不可 | 30-2555日 | 自動（SnapVault） |
| 3 | AWS Backup (ローカル) | Vault 内保護 | 30-90日 | 自動（日次 3:00AM） |
| 4 | Air-gapped Vault | 別アカウント + Vault Lock | 60-180日 | 自動（日次 4:00AM コピー） |

## 日常運用

### バックアップ状態の確認

```bash
# AWS Backup ジョブ状態確認
aws backup list-backup-jobs \
  --by-resource-type FSx \
  --by-state COMPLETED \
  --max-results 5

# FSxN スナップショット確認（ONTAP CLI）
# ssh fsxadmin@<management-endpoint>
# > volume snapshot show -volume vol_production -fields create-time,snaplock-expiry-time
```

### バックアップ失敗時の対応

CloudWatch Alarm `BackupFailureAlarm` が発火した場合：

1. AWS Backup コンソールでジョブ詳細を確認
2. 失敗原因を特定（容量不足、IAM 権限、ネットワーク）
3. 原因を解消後、手動バックアップを実行：
```bash
aws backup start-backup-job \
  --backup-vault-name <vault-name> \
  --resource-arn arn:aws:fsx:<region>:<account>:file-system/<fs-id> \
  --iam-role-arn <backup-role-arn>
```

## 定期確認項目

| 頻度 | 確認内容 | 手順 |
|------|---------|------|
| 日次 | Backup ジョブ成功 | CloudWatch Alarm 確認 |
| 週次 | TPS スナップショット数 | ONTAP CLI で確認 |
| 月次 | SnapLock ボリューム使用率 | CloudWatch メトリクス |
| 四半期 | 復旧テスト実行 | `restore-procedures.md` 参照 |
