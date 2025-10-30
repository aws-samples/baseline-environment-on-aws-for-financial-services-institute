import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { IAMBackupServiceRole } from './iam-backup-service-role';
import { RestoreStepFunctions } from './restore-step-functions';

export interface CyberResilienceRestoreProps {
  /**
   * データバンカーアカウントID
   */
  dataVaultAccountId: string;
  /**
   * 共有バックアップボルト名
   */
  sharedBackupVaultName: string;
  /**
   * 環境名
   */
  environment: string;
  /**
   * 通知用メールアドレス
   */
  notificationEmail?: string;
  /**
   * AdministratorAccess権限を使用するかどうか
   */
  useAdministratorAccess?: boolean;
  /**
   * 復旧ポイント設定
   */
  recoveryPoints?: {
    aurora?: {
      recoveryPointArn: string;
      snapshotArn: string;
      targetClusterName: string;
      description?: string;
    };
    dynamodb?: {
      recoveryPointArn: string;
      targetTableName: string;
      description?: string;
    };
  };
}

/**
 * サイバーレジリエンス復旧システム（StepFunctions版）
 *
 * 新しい軽量な実装:
 * - RestoreStepFunctionsによる復旧ワークフロー
 * - IAMBackupServiceRoleによる権限管理
 * - Parameter Storeによる設定管理
 * - SNS通知システム
 */
export class CyberResilienceRestore extends Construct {
  public readonly backupServiceRole: IAMBackupServiceRole;
  public readonly restoreStepFunctions: RestoreStepFunctions;
  public readonly notificationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: CyberResilienceRestoreProps) {
    super(scope, id);

    // 1. 通知システム
    this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `cyber-resilience-notifications-${props.environment}`,
      displayName: 'Cyber Resilience Restore Notifications',
    });

    if (props.notificationEmail) {
      this.notificationTopic.addSubscription(new subscriptions.EmailSubscription(props.notificationEmail));
    }

    // 2. IAMバックアップサービスロール
    this.backupServiceRole = new IAMBackupServiceRole(this, 'BackupServiceRole', {
      dataVaultAccountId: props.dataVaultAccountId,
      sharedBackupVaultName: props.sharedBackupVaultName,
      environment: props.environment,
    });

    // 3. StepFunctions復旧ワークフロー
    this.restoreStepFunctions = new RestoreStepFunctions(this, 'RestoreWorkflow', {
      dataVaultAccountId: props.dataVaultAccountId,
      backupServiceRoleArn: this.backupServiceRole.roleArn,
      environment: props.environment,
      useAdministratorAccess: props.useAdministratorAccess,
      notificationTopic: this.notificationTopic,
      recoveryPoints: props.recoveryPoints,
    });

    // 4. CloudWatch監視
    this.createMonitoringDashboard(props);

    // 5. Parameter Storeに設定保存
    this.saveConfigurationParameters(props);

    // 6. CloudFormation出力
    this.createOutputs();
  }

  private createMonitoringDashboard(props: CyberResilienceRestoreProps) {
    // CloudWatchダッシュボード
    const dashboard = new cloudwatch.Dashboard(this, 'CyberResilienceDashboard', {
      dashboardName: `cyber-resilience-${props.environment}`,
    });

    // StepFunctions実行メトリクス
    const stepFunctionsWidget = new cloudwatch.GraphWidget({
      title: 'StepFunctions Execution Metrics',
      left: [
        this.restoreStepFunctions.stateMachine.metricStarted(),
        this.restoreStepFunctions.stateMachine.metricSucceeded(),
        this.restoreStepFunctions.stateMachine.metricFailed(),
      ],
      right: [this.restoreStepFunctions.stateMachine.metricTime()],
    });

    // Lambda関数メトリクス
    const lambdaWidget = new cloudwatch.GraphWidget({
      title: 'Lambda Function Metrics',
      left: [
        this.restoreStepFunctions.auroraRestoreLambda.function.metricInvocations(),
        this.restoreStepFunctions.dynamodbRestoreLambda.function.metricInvocations(),
        this.restoreStepFunctions.auroraStatusLambda.function.metricInvocations(),
        this.restoreStepFunctions.dynamodbStatusLambda.function.metricInvocations(),
      ],
      right: [
        this.restoreStepFunctions.auroraRestoreLambda.function.metricErrors(),
        this.restoreStepFunctions.dynamodbRestoreLambda.function.metricErrors(),
        this.restoreStepFunctions.auroraStatusLambda.function.metricErrors(),
        this.restoreStepFunctions.dynamodbStatusLambda.function.metricErrors(),
      ],
    });

    dashboard.addWidgets(stepFunctionsWidget, lambdaWidget);

    // アラーム設定
    const stepFunctionsFailureAlarm = new cloudwatch.Alarm(this, 'StepFunctionsFailureAlarm', {
      alarmName: `cyber-resilience-stepfunctions-failure-${props.environment}`,
      alarmDescription: 'Alert when StepFunctions execution fails',
      metric: this.restoreStepFunctions.stateMachine.metricFailed(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    stepFunctionsFailureAlarm.addAlarmAction({
      bind: () => ({ alarmActionArn: this.notificationTopic.topicArn }),
    });
  }

  private saveConfigurationParameters(props: CyberResilienceRestoreProps) {
    // 動的設定のみParameter Storeに保存（静的設定はparameter.tsから直接参照）

    new ssm.StringParameter(this, 'NotificationTopicArnParam', {
      parameterName: `/cyber-resilience/${props.environment}/notification-topic-arn`,
      stringValue: this.notificationTopic.topicArn,
      description: 'SNS topic ARN for notifications',
    });

    new ssm.StringParameter(this, 'StateMachineArnParam', {
      parameterName: `/cyber-resilience/${props.environment}/state-machine-arn`,
      stringValue: this.restoreStepFunctions.stateMachine.stateMachineArn,
      description: 'StepFunctions state machine ARN for restore workflow',
    });

    // 復旧ポイント設定をParameter Storeに保存
    if (props.recoveryPoints?.aurora?.snapshotArn) {
      new ssm.StringParameter(this, 'AuroraSnapshotArnParam', {
        parameterName: `/cyber-resilience/${props.environment}/aurora-snapshot-arn`,
        stringValue: props.recoveryPoints.aurora.snapshotArn,
        description: 'Aurora shared snapshot ARN for restore',
      });
    }

    // 注意: 静的設定（復旧ポイントARN、アカウントID等）はparameter.tsから直接参照
    // Parameter Storeの冗長性を削減し、設定の一元化を実現
  }

  private createOutputs() {
    new cdk.CfnOutput(this, 'CyberResilienceRestoreSystemArn', {
      value: this.restoreStepFunctions.stateMachine.stateMachineArn,
      description: 'Main ARN for the cyber resilience restore system (StepFunctions)',
      exportName: `${cdk.Stack.of(this).stackName}-CyberResilienceSystemArn`,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.restoreStepFunctions.stateMachine.stateMachineArn,
      description: 'ARN of the restore StepFunctions state machine',
      exportName: `${cdk.Stack.of(this).stackName}-RestoreStateMachineArn`,
    });

    new cdk.CfnOutput(this, 'NotificationTopicArnOutput', {
      value: this.notificationTopic.topicArn,
      description: 'SNS topic ARN for cyber resilience notifications',
      exportName: `${cdk.Stack.of(this).stackName}-NotificationTopicArn`,
    });

    new cdk.CfnOutput(this, 'BackupServiceRoleArn', {
      value: this.backupServiceRole.roleArn,
      description: 'IAM role ARN for backup service operations',
      exportName: `${cdk.Stack.of(this).stackName}-BackupServiceRoleArn`,
    });
  }
}
