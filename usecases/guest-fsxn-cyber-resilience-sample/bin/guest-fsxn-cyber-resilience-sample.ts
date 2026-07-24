import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { WorkloadStack } from '../lib/workload/stack/workload-stack';
import { DataBankerStack } from '../lib/data-banker/stack/data-banker-stack';
import { RestoreStack } from '../lib/restore/stack/restore-stack';
import { applyNagSuppressions } from '../lib/nag-suppressions';
import { devParameter } from '../parameter';

const app = new cdk.App();

// cdk-nag: AwsSolutions パック適用
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Parameter validation
const validThroughputs = [128, 256, 512, 1024, 2048, 4096];
if (!validThroughputs.includes(devParameter.fsxnThroughputCapacityMBps)) {
  throw new Error(
    `Invalid throughput: ${devParameter.fsxnThroughputCapacityMBps}. Must be one of: ${validThroughputs.join(', ')}`,
  );
}
if (devParameter.fsxnStorageCapacityGiB < 1024) {
  throw new Error(`Storage capacity must be >= 1024 GiB. Got: ${devParameter.fsxnStorageCapacityGiB}`);
}
if (devParameter.tpsRetentionDays < 1) {
  throw new Error(`TPS retention must be >= 1 day. Got: ${devParameter.tpsRetentionDays}`);
}

// Workload Account Stack
const workloadStack = new WorkloadStack(app, 'Dev-FSxNCyberResilience-Workload', {
  description: 'BLEA for FSI: FSxN Cyber Resilience - Workload Account (tag:guest-fsxn-cyber-resilience-sample)',
  env: {
    account: devParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws-for-financial-services-institute',
    Environment: devParameter.envName,
  },
  envName: devParameter.envName,
  monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
  monitoringSlackWorkspaceId: devParameter.monitoringSlackWorkspaceId,
  monitoringSlackChannelId: devParameter.monitoringSlackChannelId,
  vpcCidr: devParameter.vpcCidr,
  fsxnStorageCapacityGiB: devParameter.fsxnStorageCapacityGiB,
  fsxnThroughputCapacityMBps: devParameter.fsxnThroughputCapacityMBps,
  fsxnDeploymentType: devParameter.fsxnDeploymentType,
  fsxnSvmName: devParameter.fsxnSvmName,
  fsxnProductionVolumeName: devParameter.fsxnProductionVolumeName,
  fsxnProductionVolumeSizeMiB: devParameter.fsxnProductionVolumeSizeMiB,
  fsxnJunctionPath: devParameter.fsxnJunctionPath,
  ontapSecretArn: devParameter.ontapSecretArn,
  tpsRetentionDays: devParameter.tpsRetentionDays,
  arpInitialMode: devParameter.arpInitialMode,
  snaplockVolumeName: devParameter.snaplockVolumeName,
  snaplockVolumeSizeMiB: devParameter.snaplockVolumeSizeMiB,
  snaplockRetentionDays: devParameter.snaplockRetentionDays,
  snaplockMinimumRetentionDays: devParameter.snaplockMinimumRetentionDays,
  snaplockMaximumRetentionYears: devParameter.snaplockMaximumRetentionYears,
  snaplockPrivilegedDelete: devParameter.snaplockPrivilegedDelete,
  backupRetentionDays: devParameter.backupRetentionDays,
  dataBankerVaultArn: devParameter.dataBankerVaultArn,
  enableNetworkIsolation: devParameter.enableNetworkIsolation,
  enableSnapVault: devParameter.enableSnapVault,
});
applyNagSuppressions(workloadStack);

// TODO: Data Banker Account Stack
// TODO: Restore Account Stack

// Data Banker Account Stack (deploy to separate account)
new DataBankerStack(app, 'Dev-FSxNCyberResilience-DataBanker', {
  description: 'BLEA for FSI: FSxN Cyber Resilience - Data Banker Account (tag:guest-fsxn-cyber-resilience-sample)',
  env: {
    account: devParameter.dataBankerAccountId || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws-for-financial-services-institute',
    Environment: devParameter.envName,
  },
  envName: devParameter.envName,
  vaultLockRetentionDays: devParameter.snaplockRetentionDays,
  restoreAccountId: devParameter.restoreAccountId,
});

// Restore Account Stack (deploy to separate account)
const restoreStack = new RestoreStack(app, 'Dev-FSxNCyberResilience-Restore', {
  description: 'BLEA for FSI: FSxN Cyber Resilience - Restore Account (tag:guest-fsxn-cyber-resilience-sample)',
  env: {
    account: devParameter.restoreAccountId || process.env.CDK_DEFAULT_ACCOUNT,
    region: devParameter.env?.region || process.env.CDK_DEFAULT_REGION,
  },
  tags: {
    Repository: 'aws-samples/baseline-environment-on-aws-for-financial-services-institute',
    Environment: devParameter.envName,
  },
  envName: devParameter.envName,
  monitoringNotifyEmail: devParameter.monitoringNotifyEmail,
  dataBankerVaultArn: devParameter.dataBankerVaultArn || '',
});
applyNagSuppressions(restoreStack);
