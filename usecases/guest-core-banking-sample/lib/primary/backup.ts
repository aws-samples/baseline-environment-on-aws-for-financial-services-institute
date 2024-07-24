import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as backup from 'aws-cdk-lib/aws-backup';
import { Schedule } from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import { DbAuroraPgGlobalPrimary } from './db-aurora-pg-global-primary';
import { DbDynamoDbGlobal } from './db-dynamoDb-global';

/*
 * Backupの作成
 */

interface BackupProps {
  PrimaryDB: DbAuroraPgGlobalPrimary;
  dynamoDb: DbDynamoDbGlobal;
}

export class Backup extends Construct {
  constructor(scope: Construct, id: string, props: BackupProps) {
    super(scope, id);

    const { PrimaryDB, dynamoDb } = props;

    // Backup Vault
    const backupVault = new backup.BackupVault(this, 'BackupVault', {
      lockConfiguration: {
        minRetention: cdk.Duration.days(1),
        maxRetention: cdk.Duration.days(10),
        // changeableFor: cdk.Duration.days(3), // コンプライアンスモードとする場合のサンプル
      },
    });
    // Backup Rule
    const backupPlanRule = new backup.BackupPlanRule({
      // backupVault: backupVault,
      enableContinuousBackup: true,
      // UTC 16:00, JST 1:00
      scheduleExpression: Schedule.cron({ hour: '16', minute: '0' }),
      startWindow: cdk.Duration.hours(1),
      completionWindow: cdk.Duration.hours(8),
      deleteAfter: cdk.Duration.days(10),
    });
    // Backup Plan
    const backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
      backupPlanRules: [backupPlanRule],
      backupVault: backupVault,
    });
    // Backup Selection
    new backup.BackupSelection(this, 'BackupSelection', {
      backupPlan: backupPlan,
      resources: [
        backup.BackupResource.fromRdsDatabaseCluster(PrimaryDB.cluster),
        backup.BackupResource.fromArn(dynamoDb.table.attrArn),
      ],
    });
    // Backup Service Role
    new iam.Role(this, 'AWSBackupDefaultServiceRole', {
      assumedBy: new iam.ServicePrincipal('backup.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForRestores'),
      ],
      roleName: 'AWSBackupDefaultServiceRole',
      path: '/service-role/',
    });
  }
}
