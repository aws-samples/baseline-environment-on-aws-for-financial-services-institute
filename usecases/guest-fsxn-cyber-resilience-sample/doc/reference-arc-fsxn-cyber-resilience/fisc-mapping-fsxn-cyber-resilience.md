# FISC 実務基準対策 一覧 [FSxN サイバーレジリエンス]

> FISC 安全対策基準（第 10 版）実務基準への対応

## 対応一覧

| FISC 実務基準 | 基準概要                 | 対策内容                                   | CDK 実装                             |
| ------------- | ------------------------ | ------------------------------------------ | ------------------------------------ |
| 実 8          | 情報システムの可用性確保 | FSxN Multi-AZ 配置、自動フェイルオーバー   | `FsxnStorage` (MULTI_AZ_1)           |
| 実 43         | バックアップの確保       | TPS + AWS Backup + Air-gapped Vault        | `BackupPlan`, `DataBankerStack`      |
| 実 44         | 復旧手順の整備・訓練     | StepFunctions 自動復旧 (RTO < 4h)          | `RestoreStack`                       |
| 実 46         | 障害対応の記録           | CloudWatch Logs 3 年保持、incident_id ログ | `NetworkIsolation` (LogGroup)        |
| 実 116        | サイバー攻撃対策         | ARP/AI 自動検知 + GuardDuty + 自動隔離     | `FsxnProtection`, `NetworkIsolation` |
| 実 117        | データの保護             | TPS (管理者削除不可) + SnapLock (WORM)     | `FsxnProtection`, `SnapLockVolume`   |
| 実 118        | 暗号化の実施             | KMS CMK (自動ローテーション)               | `CMK` (enableKeyRotation: true)      |
| 実 119        | アクセス制御             | Isolated VPC + SG + IAM 最小権限           | `Networking`                         |
| 実 120        | 監視・ログ               | CloudWatch Alarms 4 つ + SNS 通知          | `Monitoring`                         |

## 詳細マッピング

### 実 8: 可用性確保

**要件**: 情報システムの可用性を確保するための対策を講じること

**対策**:

- FSxN Multi-AZ 配置（2AZ 間の同期レプリケーション）
- 自動フェイルオーバー（AZ 障害時、RTO < 30 秒）
- 本番環境では `fsxnDeploymentType: 'MULTI_AZ_1'` を使用

### 実 43: バックアップの確保

**要件**: データのバックアップを適切に確保し、安全に保管すること

**対策**:
| バックアップ層 | 保護レベル | 保持期間 |
|-------------|----------|---------|
| Tamperproof Snapshot | 管理者削除不可 | 7-14 日 |
| SnapLock Volume | WORM（物理的に変更不可） | 30-2555 日 |
| AWS Backup (ローカル) | Vault 内 | 30-90 日 |
| Air-gapped Vault (別アカウント) | Vault Lock + 別アカウント | 60-180 日 |

### 実 44: 復旧手順の整備

**要件**: 障害発生時の復旧手順を整備し、定期的に訓練すること

**対策**:

- StepFunctions による自動復旧ワークフロー
- RTO 目標: 4 時間以内
- 復旧手順: `restore-procedures.md` に文書化
- 訓練: `cdk deploy` で検証環境に再現可能

### 実 116: サイバー攻撃対策

**要件**: サイバー攻撃に対する防御、検知、対応、復旧の態勢を整備すること

**対策**:

- **防御**: Isolated VPC（インターネットなし）、SG ルール
- **検知**: ARP/AI（ONTAP ネイティブ）+ GuardDuty（AWS ネイティブ）
- **対応**: 自動ネットワーク隔離（NACL deny-all）+ SNS 通知
- **復旧**: StepFunctions 自動リストア

### 実 117: データの保護

**要件**: データの重要度に応じた保護対策を講じること

**対策**:

- **Tamperproof Snapshot**: fsxadmin でも削除不可能なスナップショット
- **SnapLock Enterprise**: WORM 保護（保持期間内は物理的に変更不可）
- **privilegedDelete: PERMANENTLY_DISABLED**: 不可逆設定（一度設定すると管理者特権削除も不可）

### 実 118: 暗号化の実施

**要件**: 機密性の高いデータは暗号化すること

**対策**:

- FSxN: KMS CMK による保存時暗号化
- KMS キーローテーション: 有効
- VPC Endpoint 経由の通信（TLS）
- Secrets Manager によるパスワード管理

## CDK Construct と FISC 基準の対応

| CDK Construct      | FISC 基準      | リソース数                                   |
| ------------------ | -------------- | -------------------------------------------- |
| `Networking`       | 実 119         | 12 (VPC, Subnets, SGs, Endpoints)            |
| `FsxnStorage`      | 実 8           | 4 (FS, SVM, Volume, KMS)                     |
| `FsxnProtection`   | 実 116, 実 117 | 5 (Lambda, CR×2, Provider, Role)             |
| `SnapLockVolume`   | 実 43, 実 117  | 1 (Volume)                                   |
| `BackupPlan`       | 実 43          | 4 (Vault, Plan, Selection, Alarm)            |
| `NetworkIsolation` | 実 116, 実 46  | 6 (Rule, Lambda, LogGroup, Role, Permission) |
| `Monitoring`       | 実 120         | 5 (Topic, Subscription, Alarms×3)            |
| `DataBankerStack`  | 実 43          | 4 (Vault, Policy, RAM)                       |
| `RestoreStack`     | 実 44          | 7 (StateMachine, LogGroup, Roles, SNS)       |

## 注意事項

- 本マッピングは参考情報であり、FISC 準拠の最終判断は各金融機関の責任において行ってください
- ONTAP バージョン要件: TPS(9.12+), ARP(9.13+), SnapLock(9.7+)
- ARP は 30 日間の学習期間後に手動で active モードに遷移が必要です
- SnapLock の `PERMANENTLY_DISABLED` 設定は不可逆です。本番環境での設定前に十分な検討を行ってください
