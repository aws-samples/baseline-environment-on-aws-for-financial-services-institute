# BLEA for FSI: FSxN Cyber Resilience Sample

## Overview

A multi-layered cyber resilience solution leveraging Amazon FSx for NetApp ONTAP native security features. Protects data against ransomware attacks even when administrator accounts are compromised.

## Architecture

```
[Workload Account]
├── VPC (Multi-AZ, Private Subnets)
│   └── FSx for NetApp ONTAP
│       ├── Production Volume
│       │   ├── Tamperproof Snapshot (undeletable even by admins)
│       │   ├── ARP/AI (automatic ransomware detection)
│       │   └── Storage Efficiency
│       └── SnapLock Enterprise Volume (WORM)
├── AWS Backup → Air-gapped Vault (separate account)
├── GuardDuty → Automatic Network Isolation
└── CloudWatch Alarms + SNS

[Data Banker Account]
├── Logically Air-gapped Vault (Vault Lock)
└── RAM Share → Restore Account

[Restore Account]
└── StepFunctions Automated Recovery Workflow (RTO < 4 hours)
```

## Defense Layers

| Layer | Capability | Implementation |
|-------|-----------|----------------|
| Detection | Automatic ransomware detection | ARP/AI (ONTAP Custom Resource) |
| Protection | Admin-proof snapshots | Tamperproof Snapshot (TPS) |
| Protection | WORM backup | SnapLock Enterprise Volume |
| Isolation | Logical backup isolation | Air-gapped Vault (separate account) |
| Response | Automatic network containment | GuardDuty → Lambda → NACL |
| Recovery | Automated restore | StepFunctions (within 4 hours) |

## Prerequisites

1. AWS CDK CLI + Node.js >= 20.x
2. 3 AWS accounts (Workload / Data Banker / Restore)
3. **FSxN admin password stored in Secrets Manager**:
   ```bash
   aws secretsmanager create-secret \
     --name fsxn-admin-password \
     --secret-string '{"password":"YOUR_FSXADMIN_PASSWORD"}'
   ```
4. ONTAP version requirements:
   - Tamperproof Snapshot (TPS): ONTAP 9.12+
   - ARP/AI: ONTAP 9.13+ (learning → active transition after 30-day period, manual)
   - SnapLock Enterprise: ONTAP 9.7+

### ARP Learning → Active Transition

ARP starts in `learning` mode at initial deployment. After 30 days of learning, manually transition to active mode:

```bash
# ONTAP CLI (SSH or System Manager)
security anti-ransomware volume enable -volume vol_production -vserver svm-resilience
```

Or via ONTAP REST API:
```bash
curl -X PATCH "https://<mgmt-endpoint>/api/storage/volumes/<vol-uuid>" \
  -H "Content-Type: application/json" \
  -d '{"anti_ransomware": {"state": "active"}}' \
  -u "fsxadmin:<password>"
```

## Deployment

### Deployment Order (Important)

1. **Data Banker Account** → Create Air-gapped Vault
2. **Workload Account** → FSxN + TPS + ARP + Backup
3. **Restore Account** → StepFunctions workflow

```bash
# 1. Data Banker
npx cdk deploy Dev-FSxNCyberResilience-DataBanker --profile data-banker

# 2. Workload (set Data Banker Vault ARN in parameter.ts first)
npx cdk deploy Dev-FSxNCyberResilience-Workload --profile workload

# 3. Restore
npx cdk deploy Dev-FSxNCyberResilience-Restore --profile restore
```

## FISC Security Standards Mapping

| Standard | Countermeasure | Implementation |
|----------|---------------|----------------|
| Practice 43 | Backup | Snapshot + AWS Backup + Air-gapped Vault |
| Practice 44 | Recovery | StepFunctions automated restore (RTO < 4h) |
| Practice 116 | Cyber attack defense | ARP/AI + GuardDuty + automatic isolation |
| Practice 117 | Data protection | TPS (admin-undeletable) + SnapLock (WORM) |
| Practice 8 | Availability | Multi-AZ + automatic failover |

## Cost Estimate

| Component | Monthly Cost (USD) |
|-----------|-------------------|
| Workload (Multi-AZ, 128MBps, 1TiB + SnapLock 50GiB) | ~$600 |
| Data Banker (Backup Vault storage) | ~$25/TiB |
| Restore (standby: StepFunctions only) | < $1 |

## License

MIT-0
