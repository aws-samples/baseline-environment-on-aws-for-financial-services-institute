import * as cdk from 'aws-cdk-lib';
import {
  aws_backup as backup,
  aws_events as events,
  aws_iam as iam,
  aws_sns as sns,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface BackupPlanProps {
  fileSystemId: string;
  retentionDays: number;
  dataBankerVaultArn?: string;
  alarmTopic: sns.ITopic;
}

export class BackupPlan extends Construct {
  constructor(scope: Construct, id: string, props: BackupPlanProps) {
    super(scope, id);

    // Backup Vault (local)
    const vault = new backup.BackupVault(this, 'Vault', {
      backupVaultName: `fsxn-cyber-resilience-vault-${cdk.Names.uniqueId(this).slice(-8).toLowerCase()}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Backup Plan: daily FSxN volume backups
    const plan = new backup.BackupPlan(this, 'Plan', {
      backupPlanName: 'fsxn-cyber-resilience-daily',
    });

    // Daily backup rule
    plan.addRule(
      new backup.BackupPlanRule({
        ruleName: 'DailyBackup',
        scheduleExpression: events.Schedule.cron({ hour: '3', minute: '0' }),
        deleteAfter: cdk.Duration.days(props.retentionDays),
        backupVault: vault,
      }),
    );

    // Cross-account copy rule (to Data Banker Air-gapped Vault)
    if (props.dataBankerVaultArn) {
      plan.addRule(
        new backup.BackupPlanRule({
          ruleName: 'CopyToAirGappedVault',
          scheduleExpression: events.Schedule.cron({ hour: '4', minute: '0' }),
          deleteAfter: cdk.Duration.days(props.retentionDays * 2),
          copyActions: [
            {
              destinationBackupVault: backup.BackupVault.fromBackupVaultArn(
                this,
                'AirGappedVault',
                props.dataBankerVaultArn,
              ),
              deleteAfter: cdk.Duration.days(props.retentionDays * 2),
            },
          ],
        }),
      );
    }

    // Selection: FSxN File System
    plan.addSelection('FsxnSelection', {
      resources: [
        backup.BackupResource.fromArn(
          `arn:aws:fsx:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:file-system/${props.fileSystemId}`,
        ),
      ],
    });

    // CloudWatch Alarm: Backup Job Failure
    const backupFailureAlarm = new cw.Alarm(this, 'BackupFailureAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/Backup',
        metricName: 'NumberOfBackupJobsFailed',
        statistic: 'Sum',
        period: cdk.Duration.hours(24),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'FSxN backup job failed. Check AWS Backup console. Runbook: doc/backup-procedures.md',
    });
    backupFailureAlarm.addAlarmAction(new cw_actions.SnsAction(props.alarmTopic));
  }
}
