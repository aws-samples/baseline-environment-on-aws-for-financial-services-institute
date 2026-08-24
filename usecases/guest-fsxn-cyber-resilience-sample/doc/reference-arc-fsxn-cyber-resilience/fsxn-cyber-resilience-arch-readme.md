# 金融ワークロードアーキテクチャ解説 [FSxN サイバーレジリエンス]

## 概要

Amazon FSx for NetApp ONTAP のネイティブセキュリティ機能を活用した、多層防御のサイバーレジリエンスアーキテクチャです。管理者アカウントが侵害された場合でもデータを保護し、FISC 安全対策基準に準拠した金融グレードのデータ保護を実現します。

## ビジネス課題

金融機関は高度なランサムウェア攻撃に直面しています：

1. 攻撃者が管理者権限を奪取
2. バックアップデータを削除・暗号化
3. 本番データを暗号化し身代金を要求

従来の対策（AWS Backup のみ）では、管理者権限が侵害された場合にバックアップも削除可能です。本アーキテクチャはストレージレベルで **管理者でも削除不可能な保護** を実現します。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│ ワークロードアカウント                                              │
│                                                                  │
│  VPC (Multi-AZ, Isolated Private Subnets)                       │
│  ├── FSx for NetApp ONTAP (Multi-AZ, KMS 暗号化)                │
│  │   ├── 本番ボリューム                                           │
│  │   │   ├── Tamperproof Snapshot (管理者削除不可, 7-14日保持)     │
│  │   │   └── ARP/AI (ランサムウェア自動検知, learning→active)      │
│  │   └── SnapLock Enterprise ボリューム (WORM, 30-2555日保持)     │
│  │       └── SnapVault (本番→SnapLock 自動レプリケーション)        │
│  │                                                               │
│  ├── AWS Backup (日次バックアップ + クロスアカウントコピー)           │
│  ├── GuardDuty → EventBridge → Lambda → NACL (自動隔離)          │
│  └── CloudWatch Alarms (4) + SNS                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         │ AWS Backup クロスアカウントコピー
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ データバンカーアカウント（論理的エアギャップ）                         │
│  ├── Backup Vault (Vault Lock: 削除ポリシー拒否)                  │
│  └── AWS RAM → リストアアカウントに共有                            │
└──────────────────────────────────────────────────────────────────┘
         │ RAM 共有
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ リストアアカウント                                                 │
│  └── StepFunctions 自動復旧ワークフロー (RTO < 4 時間)            │
└──────────────────────────────────────────────────────────────────┘
```

## 防御レイヤー詳細

### レイヤー 1: 検知 — Autonomous Ransomware Protection (ARP/AI)

ONTAP のネイティブ機能で、ファイルシステムの異常なアクティビティ（大量暗号化、拡張子変更）をリアルタイムに検知します。

- **学習期間**: 30 日間（正常なアクセスパターンを学習）
- **検知後**: 自動 Snapshot 作成 + 管理者通知
- **ONTAP バージョン要件**: 9.13+

### レイヤー 2: 保護 — Tamperproof Snapshot (TPS)

スナップショットにロック期間を設定し、その間はいかなる管理者（fsxadmin 含む）も削除できません。

- **保持期間**: パラメータ設定可能（開発: 7 日、本番: 14 日）
- **ONTAP バージョン要件**: 9.12+

### レイヤー 3: 保護 — SnapLock Enterprise

WORM（Write Once Read Many）保護を提供するボリューム。一度コミットされたファイルは保持期間満了まで変更・削除不可能です。

- **保持期間**: 最小 7 日〜最大 7 年（FISC 要件に応じて設定）
- **特権削除**: `PERMANENTLY_DISABLED`（不可逆。一度設定すると管理者でも削除不可）
- **自動コミット**: 1 時間（ファイルが 1 時間未変更なら WORM 化）

### レイヤー 4: 隔離 — Air-gapped Vault（別アカウント）

バックアップデータをワークロードアカウントから物理的に分離します。

- **Vault Lock**: AWS Backup Vault に削除拒否ポリシーを強制
- **クロスアカウント**: ワークロードアカウントの管理者がバックアップを削除できない
- **RAM 共有**: リストアアカウントのみがアクセス可能

### レイヤー 5: 対応 — 自動ネットワーク隔離

GuardDuty が HIGH/CRITICAL の脅威を検知した場合、自動的にネットワークを遮断します。

- **トリガー**: GuardDuty HIGH/CRITICAL finding
- **実行**: EventBridge → Lambda → NACL deny-all ルール追加
- **通知**: SNS → メール（+ オプション Chatbot → Slack）
- **ログ**: incident_id による追跡可能性

### レイヤー 6: 復旧 — StepFunctions 自動リストア

データバンカーアカウントのバックアップから自動復旧します。

- **RTO**: 4 時間以内（FISC 実 44 準拠）
- **ワークフロー**: StepFunctions（バックアップ特定 → リストア → 検証 → 通知）

## ONTAP バージョン要件

| 機能                 | 最低バージョン | 備考                       |
| -------------------- | -------------- | -------------------------- |
| Tamperproof Snapshot | ONTAP 9.12+    | FSxN で利用可能            |
| ARP/AI               | ONTAP 9.13+    | learning→active 遷移は手動 |
| SnapLock Enterprise  | ONTAP 9.7+     | FSxN で利用可能            |
| SnapVault            | ONTAP 9.6+     | SnapMirror vault ポリシー  |

## コスト見積もり

| 構成要素                                          | 月額概算 (USD) |
| ------------------------------------------------- | -------------- |
| FSxN (Multi-AZ, 1TiB, 128MBps) + SnapLock (50GiB) | ~$600          |
| AWS Backup ストレージ                             | ~$25/TiB       |
| Data Banker Vault (Vault Lock)                    | < $1           |
| Restore Account (StepFunctions 待機)              | < $1           |
| **合計**                                          | **~$625**      |

## セキュリティ設計

- **VPC**: Isolated Private Subnets（IGW/NAT なし）
- **暗号化**: KMS CMK（自動ローテーション有効）
- **ネットワーク**: VPC Endpoints 経由のみ（SecretsManager, CloudWatch Logs, Backup, S3）
- **IAM**: 最小権限（Lambda は SecretsManager 読み取りのみ、FSxN は SG で制限）
- **監査**: CloudWatch Logs 3 年保持（FISC 準拠）

## 既存サイバーレジリエンスアーキテクチャとの関係

本アーキテクチャは BLEA for FSI の既存サイバーレジリエンスパターン（AWS Backup + GuardDuty 中心）を **補完** するものです：

| 観点               | 既存パターン    | 本パターン（FSxN）            |
| ------------------ | --------------- | ----------------------------- |
| ストレージ         | EBS, S3         | FSx for NetApp ONTAP          |
| バックアップ保護   | Vault Lock      | TPS + SnapLock + Vault Lock   |
| ランサムウェア検知 | GuardDuty       | GuardDuty + ARP/AI            |
| 管理者侵害対策     | Vault Lock のみ | TPS（ストレージレベル不可変） |
| 復旧方式           | 手動            | StepFunctions 自動            |

FSxN を利用する金融機関は、ONTAP のネイティブ機能により **ストレージレイヤーでの追加の保護層** を得ることができます。
