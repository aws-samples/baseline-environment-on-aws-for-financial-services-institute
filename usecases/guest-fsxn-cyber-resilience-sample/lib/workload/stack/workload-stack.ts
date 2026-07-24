import { Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Networking } from '../construct/networking';
import { FsxnStorage } from '../construct/fsxn-storage';
import { FsxnProtection } from '../construct/fsxn-protection';
import { SnapLockVolume } from '../construct/snaplock-volume';
import { SnapVaultReplication } from '../construct/snapvault-replication';
import { BackupPlan } from '../construct/backup-plan';
import { NetworkIsolation } from '../construct/network-isolation';
import { Monitoring } from '../construct/monitoring';

export interface WorkloadStackProps extends StackProps {
  envName: string;
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  vpcCidr: string;
  fsxnStorageCapacityGiB: number;
  fsxnThroughputCapacityMBps: number;
  fsxnDeploymentType: 'MULTI_AZ_1' | 'SINGLE_AZ_1';
  fsxnSvmName: string;
  fsxnProductionVolumeName: string;
  fsxnProductionVolumeSizeMiB: number;
  fsxnJunctionPath: string;
  ontapSecretArn: string;
  tpsRetentionDays: number;
  arpInitialMode: 'learning';
  snaplockVolumeName: string;
  snaplockVolumeSizeMiB: number;
  snaplockRetentionDays: number;
  snaplockMinimumRetentionDays: number;
  snaplockMaximumRetentionYears: number;
  snaplockPrivilegedDelete: 'PERMANENTLY_DISABLED' | 'DISABLED';
  backupRetentionDays: number;
  dataBankerVaultArn?: string;
  enableNetworkIsolation: boolean;
  enableSnapVault: boolean;
}

export class WorkloadStack extends Stack {
  constructor(scope: Construct, id: string, props: WorkloadStackProps) {
    super(scope, id, props);

    // KMS Key for encryption
    const cmk = new Key(this, 'CMK', {
      enableKeyRotation: true,
      description: 'BLEA FSxN Cyber Resilience: CMK for encryption at rest',
    });

    // Networking
    const networking = new Networking(this, 'Networking', {
      vpcCidr: props.vpcCidr,
    });

    // FSxN Storage (production volume)
    const fsxnStorage = new FsxnStorage(this, 'FsxnStorage', {
      vpc: networking.vpc,
      fsxnSecurityGroup: networking.fsxnSecurityGroup,
      privateSubnetRouteTableIds: networking.privateSubnetRouteTableIds,
      storageCapacityGiB: props.fsxnStorageCapacityGiB,
      throughputCapacityMBps: props.fsxnThroughputCapacityMBps,
      deploymentType: props.fsxnDeploymentType,
      svmName: props.fsxnSvmName,
      volumeName: props.fsxnProductionVolumeName,
      volumeSizeMiB: props.fsxnProductionVolumeSizeMiB,
      junctionPath: props.fsxnJunctionPath,
      kmsKey: cmk,
    });

    // Monitoring (needs fileSystemId from FSxN)
    const monitoring = new Monitoring(this, 'Monitoring', {
      monitoringNotifyEmail: props.monitoringNotifyEmail,
      monitoringSlackWorkspaceId: props.monitoringSlackWorkspaceId,
      monitoringSlackChannelId: props.monitoringSlackChannelId,
      fileSystemId: fsxnStorage.fileSystemId,
    });

    // FSxN Protection (TPS + ARP/AI via Custom Resource)
    new FsxnProtection(this, 'FsxnProtection', {
      vpc: networking.vpc,
      lambdaSecurityGroup: networking.lambdaSecurityGroup,
      managementEndpoint: fsxnStorage.managementEndpoint,
      secretArn: props.ontapSecretArn,
      svmName: props.fsxnSvmName,
      volumeName: props.fsxnProductionVolumeName,
      tpsRetentionDays: props.tpsRetentionDays,
      arpInitialMode: props.arpInitialMode,
    });

    // SnapLock Enterprise Volume (immutable backup target)
    const snaplockVol = new SnapLockVolume(this, 'SnapLockVolume', {
      svmId: fsxnStorage.svmId,
      volumeName: props.snaplockVolumeName,
      volumeSizeMiB: props.snaplockVolumeSizeMiB,
      retentionDays: props.snaplockRetentionDays,
      minimumRetentionDays: props.snaplockMinimumRetentionDays,
      maximumRetentionYears: props.snaplockMaximumRetentionYears,
      privilegedDelete: props.snaplockPrivilegedDelete,
    });

    // SnapVault: Replicate production snapshots to SnapLock volume
    // NOTE: Requires FSxN management endpoint to be reachable from Lambda VPC subnet.
    // Disable during initial deployment; enable after verifying network connectivity.
    if (props.enableSnapVault) {
      new SnapVaultReplication(this, 'SnapVault', {
        vpc: networking.vpc,
        lambdaSecurityGroup: networking.lambdaSecurityGroup,
        managementEndpoint: fsxnStorage.managementEndpoint,
        secretArn: props.ontapSecretArn,
        svmName: props.fsxnSvmName,
        sourceVolumeName: props.fsxnProductionVolumeName,
        destinationVolumeName: props.snaplockVolumeName,
      });
    }

    // AWS Backup Plan
    new BackupPlan(this, 'BackupPlan', {
      fileSystemId: fsxnStorage.fileSystemId,
      retentionDays: props.backupRetentionDays,
      dataBankerVaultArn: props.dataBankerVaultArn,
      alarmTopic: monitoring.alarmTopic,
    });

    // Network Isolation (GuardDuty → Lambda → NACL)
    new NetworkIsolation(this, 'NetworkIsolation', {
      vpc: networking.vpc,
      alarmTopic: monitoring.alarmTopic,
      enabled: props.enableNetworkIsolation,
    });
  }
}
