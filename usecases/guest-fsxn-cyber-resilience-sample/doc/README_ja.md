# BLEA for FSI: FSxN サイバーレジリエンス サンプル

## 概要

Amazon FSx for NetApp ONTAP のネイティブセキュリティ機能を活用した、多層防御のサイバーレジリエンスソリューションです。ランサムウェア攻撃に対して、管理者アカウントが侵害された場合でもデータを保護します。

## アーキテクチャ

```
[ワークロードアカウント]
├── VPC (Multi-AZ, プライベートサブネット)
│   └── FSx for NetApp ONTAP
│       ├── 本番ボリューム
│       │   ├── Tamperproof Snapshot (管理者でも削除不可)
│       │   ├── ARP/AI (ランサムウェア自動検知)
│       │   └── ストレージ効率化
│       └── SnapLock Enterprise ボリューム (WORM)
├── AWS Backup → Air-gapped Vault (別アカウント)
├── GuardDuty → 自動ネットワーク隔離
└── CloudWatch アラーム + SNS

[データバンカーアカウント]
├── Logically Air-gapped Vault (Vault Lock)
└── RAM 共有 → リストアアカウント

[リストアアカウント]
└── StepFunctions 自動復旧ワークフロー (RTO < 4時間)
```

## 防御レイヤー

| レイヤー | 機能                          | 実装                            |
| -------- | ----------------------------- | ------------------------------- |
| 検知     | ランサムウェア自動検知        | ARP/AI (ONTAP Custom Resource)  |
| 保護     | 管理者でも削除不可な Snapshot | Tamperproof Snapshot (TPS)      |
| 保護     | WORM バックアップ             | SnapLock Enterprise Volume      |
| 隔離     | バックアップの論理的隔離      | Air-gapped Vault (別アカウント) |
| 対応     | 自動ネットワーク遮断          | GuardDuty → Lambda → NACL       |
| 復旧     | 自動リストア                  | StepFunctions (4 時間以内)      |

## 前提条件

1. AWS CDK CLI + Node.js >= 20.x
2. 3 つの AWS アカウント（ワークロード / データバンカー / リストア）
3. **FSxN 管理パスワードを Secrets Manager に事前登録**:
   ```bash
   aws secretsmanager create-secret \
     --name fsxn-admin-password \
     --secret-string '{"password":"YOUR_FSXADMIN_PASSWORD"}'
   ```
4. ONTAP バージョン要件:
   - Tamperproof Snapshot (TPS): ONTAP 9.12+
   - ARP/AI: ONTAP 9.13+（learning → active 遷移は 30 日後に手動実行）
   - SnapLock Enterprise: ONTAP 9.7+

### ARP learning → active 遷移手順

ARP は初期デプロイ時に `learning` モードで動作します。30 日間の学習期間完了後、手動で active モードに遷移してください:

```bash
# ONTAP CLI (SSH or System Manager)
security anti-ransomware volume enable -volume vol_production -vserver svm-resilience
```

または ONTAP REST API:

```bash
curl -X PATCH "https://<mgmt-endpoint>/api/storage/volumes/<vol-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"anti_ransomware": {"state": "active"}}' \
  -u "fsxadmin:<password>"
```

## デプロイ手順

### デプロイ順序（重要）

1. **Data Banker アカウント** → Air-gapped Vault 作成
2. **Workload アカウント** → FSxN + TPS + ARP + Backup
3. **Restore アカウント** → StepFunctions ワークフロー

```bash
# 1. Data Banker
npx cdk deploy Dev-FSxNCyberResilience-DataBanker --profile data-banker

# 2. Workload (parameter.ts に Data Banker Vault ARN を設定後)
npx cdk deploy Dev-FSxNCyberResilience-Workload --profile workload

# 3. Restore
npx cdk deploy Dev-FSxNCyberResilience-Restore --profile restore
```

## FISC 安全対策基準マッピング

| 基準   | 対策             | 実装                                     |
| ------ | ---------------- | ---------------------------------------- |
| 実 43  | バックアップ     | Snapshot + AWS Backup + Air-gapped Vault |
| 実 44  | 復旧             | StepFunctions 自動リストア (RTO < 4h)    |
| 実 116 | サイバー攻撃対策 | ARP/AI + GuardDuty + 自動隔離            |
| 実 117 | データ保護       | TPS (管理者削除不可) + SnapLock (WORM)   |
| 実 8   | 可用性           | Multi-AZ + 自動フェイルオーバー          |

## コスト見積もり

| 構成                                                | 月額概算 (USD) |
| --------------------------------------------------- | -------------- |
| Workload (Multi-AZ, 128MBps, 1TiB + SnapLock 50GiB) | ~$600          |
| Data Banker (Backup Vault storage)                  | ~$25/TiB       |
| Restore (待機: StepFunctions のみ)                  | < $1           |

## ライセンス

MIT-0
