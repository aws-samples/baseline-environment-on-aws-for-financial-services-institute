import { Environment } from 'aws-cdk-lib';

/**
 * Parameters for the FSxN Cyber Resilience use case.
 * Multi-account architecture: Workload / Data Banker / Restore.
 */
export interface AppParameter {
  env?: Environment;
  envName: string;

  // Monitoring (BLEA pattern)
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;

  // Networking
  vpcCidr: string;

  // FSx for ONTAP (Workload Account)
  fsxnStorageCapacityGiB: number;
  fsxnThroughputCapacityMBps: number;
  fsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  fsxnSvmName: string;
  fsxnProductionVolumeName: string;
  fsxnProductionVolumeSizeMiB: number;
  fsxnJunctionPath: string;

  // ONTAP Custom Resource - Prerequisite: Secret must exist BEFORE deployment
  // Create manually: aws secretsmanager create-secret --name fsxn-admin-password --secret-string '{"password":"YOUR_FSXADMIN_PASSWORD"}'
  ontapSecretArn: string;

  // Tamperproof Snapshot (TPS)
  tpsRetentionDays: number; // Minimum 1 day. Locked snapshots CANNOT be deleted until expiry.

  // Autonomous Ransomware Protection (ARP/AI)
  arpInitialMode: 'learning'; // Always starts in learning mode. Transition to active after 30-day learning period.

  // SnapLock Enterprise Volume
  snaplockVolumeName: string;
  snaplockVolumeSizeMiB: number;
  snaplockRetentionDays: number; // Default retention period for WORM files
  snaplockMinimumRetentionDays: number;
  snaplockMaximumRetentionYears: number; // FISC: 7 years may be required
  // WARNING: PERMANENTLY_DISABLED is IRREVERSIBLE. Once set, privileged delete can NEVER be re-enabled.
  snaplockPrivilegedDelete: 'PERMANENTLY_DISABLED' | 'DISABLED';

  // AWS Backup
  backupRetentionDays: number;

  // Multi-Account (Cross-account references)
  dataBankerAccountId?: string;
  dataBankerVaultArn?: string;
  restoreAccountId?: string;

  // Network Isolation
  enableNetworkIsolation: boolean;

  // SnapVault Replication (requires ONTAP management endpoint reachability from Lambda)
  // Set to false for initial deployment; enable after verifying connectivity.
  enableSnapVault: boolean;
}

// Development parameter set
export const devParameter: AppParameter = {
  envName: 'Development',
  monitoringNotifyEmail: 'notify-monitoring@example.com',
  monitoringSlackWorkspaceId: '',
  monitoringSlackChannelId: '',
  vpcCidr: '10.0.0.0/16',
  fsxnStorageCapacityGiB: 1024,
  fsxnThroughputCapacityMBps: 128,
  fsxnDeploymentType: 'MULTI_AZ_1',
  fsxnSvmName: 'svm-resilience',
  fsxnProductionVolumeName: 'vol_production',
  fsxnProductionVolumeSizeMiB: 102400,
  fsxnJunctionPath: '/production',
  ontapSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:fsxn-admin-password-XXXXXX',
  tpsRetentionDays: 7,
  arpInitialMode: 'learning',
  snaplockVolumeName: 'snaplock_backup',
  snaplockVolumeSizeMiB: 51200,
  snaplockRetentionDays: 30,
  snaplockMinimumRetentionDays: 7,
  snaplockMaximumRetentionYears: 1,
  snaplockPrivilegedDelete: 'PERMANENTLY_DISABLED',
  backupRetentionDays: 30,
  enableNetworkIsolation: true,
  enableSnapVault: false, // Enable after verifying ONTAP management endpoint connectivity
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};

// Production parameter set
export const prodParameter: AppParameter = {
  envName: 'Production',
  monitoringNotifyEmail: 'notify-monitoring@example.com',
  monitoringSlackWorkspaceId: '',
  monitoringSlackChannelId: '',
  vpcCidr: '10.0.0.0/16',
  fsxnStorageCapacityGiB: 4096,
  fsxnThroughputCapacityMBps: 512,
  fsxnDeploymentType: 'MULTI_AZ_1',
  fsxnSvmName: 'svm-resilience',
  fsxnProductionVolumeName: 'vol_production',
  fsxnProductionVolumeSizeMiB: 512000,
  fsxnJunctionPath: '/production',
  ontapSecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:fsxn-admin-password-XXXXXX',
  tpsRetentionDays: 14,
  arpInitialMode: 'learning',
  snaplockVolumeName: 'snaplock_backup',
  snaplockVolumeSizeMiB: 204800,
  snaplockRetentionDays: 90,
  snaplockMinimumRetentionDays: 30,
  snaplockMaximumRetentionYears: 7, // FISC compliance: 7-year retention
  snaplockPrivilegedDelete: 'PERMANENTLY_DISABLED',
  backupRetentionDays: 90,
  dataBankerAccountId: '123456789012',
  dataBankerVaultArn: 'arn:aws:backup:ap-northeast-1:123456789012:backup-vault:air-gapped-vault',
  restoreAccountId: '123456789012',
  enableNetworkIsolation: true,
  enableSnapVault: false, // Enable after verifying ONTAP management endpoint connectivity
  // env: { account: '123456789012', region: 'ap-northeast-1' },
};
