import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CoreBankingPrimaryStack } from '../lib/primary/bleafsi-core-banking-primary-stack';
import { CoreBankingSecondaryStack } from '../lib/secondary/bleafsi-core-banking-secondary-stack';
import { CoreBankingMonitoringStack } from '../lib/monitoring/bleafsi-core-banking-monitoring-stack';
import {
  PjPrefix,
  DevParameter,
  StageParameter,
  ProdParameter,
  SampleMultiRegionAppParameter,
  CyberResilienceParameter,
} from './parameter';
import { CoreBankingArcStack } from '../lib/shared/sample-multi-region-app/bleafsi-core-banking-arc-stack';
import { CoreBankingStateMachineStack } from '../lib/shared/sample-multi-region-app/bleafsi-core-banking-statemachine-stack';
import { DataBunkerAccountStack } from '../lib/primary/cyber-resilience/data-bunker-account';
import { IsolationStack } from '../lib/primary/cyber-resilience/automated-isolation/isolation-stack';
import { CyberResilienceRestore } from '../lib/primary/cyber-resilience/cyber-resilience-restore';
/*
 * BLEA-FSI Core Banking Sample application stack
 */

const app = new cdk.App();

// スタック作成
// for Development
// Primary Region Stack
const DevPrimaryAppStack = new CoreBankingPrimaryStack(app, `${PjPrefix}-primary-Dev`, {
  description: 'BLEA for FSI Core Bankig (uksb-1tupboc63) (tag:guest-core-banking-sample)',
  ...DevParameter,
  env: {
    account: DevParameter.account,
    region: DevParameter.primary.region,
  },
  crossRegionReferences: true,
});

// Secondary Region Stack
const DevSecondaryAppStack = new CoreBankingSecondaryStack(app, `${PjPrefix}-secondary-Dev`, {
  ...DevParameter,
  env: {
    account: DevParameter.account,
    region: DevParameter.secondary.region,
  },
  crossRegionReferences: true,
  auroraSecretName: DevPrimaryAppStack.PrimaryDB.secret.secretName,
  dynamoDbGlobalTableName: DevPrimaryAppStack.dynamoDb.tableName,
  tgwRouteTableId: DevPrimaryAppStack.tgwRouteTableId,
});

if (SampleMultiRegionAppParameter.deploy) {
  if (DevPrimaryAppStack.sampleMultiRegionApp == null || DevSecondaryAppStack.sampleMultiRegionApp == null) {
    throw new Error('sampleMultiRegionApp is missing.');
  }
  // Monitoring Region Stack
  const DevMonitoringAppStack = new CoreBankingMonitoringStack(app, `${PjPrefix}-monitoring-Dev`, {
    ...DevParameter,
    env: {
      account: DevParameter.account,
      region: DevParameter.monitoring.region,
    },
    crossRegionReferences: true,
    primaryTgwRouteTableId: DevPrimaryAppStack.tgwRouteTableId,
    secondaryTgwRouteTableId: DevSecondaryAppStack.tgwRouteTableId,
  });

  const DevArcStack = new CoreBankingArcStack(app, `${PjPrefix}-arc-Dev`, {
    ...DevParameter,
    env: {
      account: DevParameter.account,
      region: 'us-east-1', // Route53 ARC must be deployed in us-east-1
    },
    crossRegionReferences: true,
    hostedZone: DevPrimaryAppStack.hostedZone.privateHostedZone,
    primaryAlb: DevPrimaryAppStack.sampleMultiRegionApp.alb,
    secondaryAlb: DevSecondaryAppStack.sampleMultiRegionApp.alb,
  });
  const DevSFnStack = new CoreBankingStateMachineStack(app, `${PjPrefix}-failover-Dev`, {
    ...DevParameter,
    env: {
      account: DevParameter.account,
      region: DevParameter.secondary.region,
    },
    crossRegionReferences: true,
    primaryParamTable: DevPrimaryAppStack.sampleMultiRegionApp.paramTable,
    secondaryParamTable: DevSecondaryAppStack.sampleMultiRegionApp.paramTable,
    primaryAuroraCluster: DevPrimaryAppStack.PrimaryDB.cluster,
    auroraGlobalDatabaseIdentifier: DevPrimaryAppStack.PrimaryDB.globalClusterIdentifier,
    secondaryAuroraCluster: DevSecondaryAppStack.secondaryDB.cluster,
    arcClusterEndpoints: DevArcStack.clusterEndpoints,
    arcClusterEndpointRegions: DevArcStack.clusterEndpointRegions,
    primaryRoutingControlArn: DevArcStack.primaryRoutingControlArn,
    secondaryRoutingControlArn: DevArcStack.secondaryRoutingControlArn,
    secondaryCanaryName: DevSecondaryAppStack.sampleMultiRegionApp.canaryName,
    monitoringAlarmName: DevMonitoringAppStack.alarmName,
  });
}

// Cyber Resilience - Network Isolation Stack (Primary Region only)
if (CyberResilienceParameter.deploy && CyberResilienceParameter.option.includes('isolation')) {
  const DevIsolationStack = new IsolationStack(app, `${PjPrefix}-isolation-Dev`, {
    description: 'BLEA for FSI Core Banking - Cyber Resilience Network Isolation (uksb-1tupboc63)',
    ...DevParameter,
    env: {
      account: DevParameter.account,
      region: DevParameter.primary.region,
    },
    vpc: DevPrimaryAppStack.myVpc,
    notifyEmail: DevParameter.notifyEmail,
    envName: DevParameter.envName,
  });

  // 依存関係を設定（Primary Stackが先にデプロイされる必要がある）
  DevIsolationStack.addDependency(DevPrimaryAppStack);
}

// for Staging
// Primary Region Stack
/*const StagePrimaryAppStack = new CoreBankingPrimaryStack(app, `${PjPrefix}-primary-Stage`, {
  ...StageParameter,
  env: {
    account: StageParameter.account,
    region: StageParameter.primary.region
  },
  crossRegionReferences: true
});

// Secondary Region Stack
const StageSecondaryAppStack = new CoreBankingSecondaryStack(app, `${PjPrefix}-secondary-Stage`, {
  ...StageParameter,
  env: {
    account: StageParameter.account,
    region: StageParameter.secondary.region
  },
  crossRegionReferences: true,
  auroraSecretName: StagePrimaryAppStack.PrimaryDB.secret.secretName,
  dynamoDbTableName: StagePrimaryAppStack.dynamoDb.tableName,
  tgwRouteTableId: StagePrimaryAppStack.tgwRouteTableId,
  auroraPrimaryCluster: StagePrimaryAppStack.PrimaryDB.cluster,
  auroraGlobalDatabaseClusterIdentifier: StagePrimaryAppStack.PrimaryDB.globalClusterIdentifier,
  primarySampleMultiRegionApp: StagePrimaryAppStack.sampleMultiRegionApp
});
*/

// for Production
// Primary Region Stack
/*const ProdPrimaryAppStack = new CoreBankingPrimaryStack(app, `${PjPrefix}-primary-Prod`, {
  ...ProdParameter,
  env: {
    account: ProdParameter.account,
    region: ProdParameter.primary.region
  },
  crossRegionReferences: true
});

// Secondary Region Stack
const ProdSecondaryAppStack = new CoreBankingSecondaryStack(app, `${PjPrefix}-secondary-Prod`, {
  ...ProdParameter,
  env: {
    account: ProdParameter.account,
    region: ProdParameter.secondary.region
  },
  crossRegionReferences: true,
  auroraSecretName: ProdPrimaryAppStack.PrimaryDB.secret.secretName,
  dynamoDbTableName: ProdPrimaryAppStack.dynamoDb.tableName,
  tgwRouteTableId: ProdPrimaryAppStack.tgwRouteTableId,
  auroraPrimaryCluster: ProdPrimaryAppStack.PrimaryDB.cluster,
  auroraGlobalDatabaseClusterIdentifier: ProdPrimaryAppStack.PrimaryDB.globalClusterIdentifier,
  primarySampleMultiRegionApp: ProdPrimaryAppStack.sampleMultiRegionApp
});
*/

// サイバーレジリエンス機能の設定
if (CyberResilienceParameter.deploy && CyberResilienceParameter.option.includes('backup')) {
  // Data Bunkerアカウントのスタック
  const dataBunkerStack = new DataBunkerAccountStack(app, `${PjPrefix}-data-bunker-Dev`, {
    description: 'Data Bunker Account Stack for Core Banking System',
    env: {
      account: CyberResilienceParameter.dataBunkerAccount.id,
      region: DevParameter.primary.region,
    },
    crossRegionReferences: true,
  });
}

if (CyberResilienceParameter.deploy && CyberResilienceParameter.option.includes('restore')) {
  const restoreStack = new cdk.Stack(app, `${PjPrefix}-restore-Dev`, {
    description: 'Restore Account Stack for Core Banking System',
    env: {
      account: CyberResilienceParameter.restoreAccount.id,
      region: CyberResilienceParameter.restoreAccount.region,
    },
    crossRegionReferences: true,
  });

  new CyberResilienceRestore(restoreStack, 'CyberResilienceRestore', {
    dataVaultAccountId: CyberResilienceParameter.dataBunkerAccount.id,
    sharedBackupVaultName: CyberResilienceParameter.dataBunkerAccount.vaultName,
    environment: DevParameter.envName,
  });
}

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';

cdk.Tags.of(DevPrimaryAppStack).add(envTagName, DevParameter.envName, {
  excludeResourceTypes: ['AWS::EC2::TransitGatewayAttachment'],
});
cdk.Tags.of(DevSecondaryAppStack).add(envTagName, DevParameter.envName);

// Cyber Resilience Isolation Stack tags
if (CyberResilienceParameter.deploy && CyberResilienceParameter.option.includes('isolation')) {
  const DevIsolationStack = app.node.tryFindChild(`${PjPrefix}-isolation-Dev`) as cdk.Stack;
  if (DevIsolationStack) {
    cdk.Tags.of(DevIsolationStack).add(envTagName, DevParameter.envName);
  }
}

//cdk.Tags.of(StagePrimaryAppStack).add(envTagName, StageParameter.envName);
//cdk.Tags.of(StageSecondaryAppStack).add(envTagName, StageParameter.envName);

//cdk.Tags.of(ProdPrimaryAppStack).add(envTagName, ProdParameter.envName);
//cdk.Tags.of(ProdSecondaryAppStack).add(envTagName, ProdParameter.envName);
