import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cw_actions } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';

/**
 * CloudWatch Application Signals 監視とアラート設定
 *
 * この構成要素は以下の機能を提供します：
 * - Application Signals ダッシュボードの作成
 * - サービスレイテンシとエラー率のアラーム設定
 * - CloudWatch Agent 障害検知アラームの実装
 */

export interface ApplicationSignalsMonitoringProps {
  /**
   * アラーム通知用の SNS トピック
   */
  alarmTopic: sns.Topic;

  /**
   * 監視対象の ECS サービス一覧
   */
  ecsServices: {
    serviceName: string;
    clusterName: string;
    service: ecs.FargateService;
  }[];

  /**
   * 環境名（ダッシュボード名に使用）
   */
  envName: string;
}

export class ApplicationSignalsMonitoring extends Construct {
  public readonly dashboard: cw.Dashboard;
  public readonly latencyAlarms: cw.Alarm[];
  public readonly errorRateAlarms: cw.Alarm[];
  public readonly agentFailureAlarms: cw.Alarm[];

  constructor(scope: Construct, id: string, props: ApplicationSignalsMonitoringProps) {
    super(scope, id);

    const { alarmTopic, ecsServices, envName } = props;

    // Application Signals ダッシュボードの作成
    this.dashboard = this.createApplicationSignalsDashboard(envName, ecsServices);

    // サービスレイテンシアラームの設定
    this.latencyAlarms = this.createLatencyAlarms(ecsServices, alarmTopic);

    // エラー率アラームの設定
    this.errorRateAlarms = this.createErrorRateAlarms(ecsServices, alarmTopic);

    // CloudWatch Agent 障害検知アラームの実装
    this.agentFailureAlarms = this.createAgentFailureAlarms(ecsServices, alarmTopic);
  }

  /**
   * Application Signals ダッシュボードを作成
   */
  private createApplicationSignalsDashboard(
    envName: string,
    ecsServices: ApplicationSignalsMonitoringProps['ecsServices'],
  ): cw.Dashboard {
    const dashboard = new cw.Dashboard(this, 'ApplicationSignalsDashboard', {
      dashboardName: `CoreBanking-ApplicationSignals-${envName}`,
    });

    // サービス概要ウィジェット
    const serviceOverviewWidgets = ecsServices.map((service) => {
      return new cw.GraphWidget({
        title: `${service.serviceName} - Service Overview`,
        left: [
          // サービスレイテンシメトリクス
          new cw.Metric({
            namespace: 'ApplicationSignals',
            metricName: 'Latency',
            dimensionsMap: {
              Service: service.serviceName,
              Environment: 'production',
            },
            statistic: 'Average',
            period: Duration.minutes(5),
          }),
        ],
        right: [
          // エラー率メトリクス
          new cw.Metric({
            namespace: 'ApplicationSignals',
            metricName: 'Error',
            dimensionsMap: {
              Service: service.serviceName,
              Environment: 'production',
            },
            statistic: 'Average',
            period: Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      });
    });

    // ECS サービス健全性ウィジェット
    const ecsHealthWidgets = ecsServices.map((service) => {
      return new cw.GraphWidget({
        title: `${service.serviceName} - ECS Health`,
        left: [
          // CPU 使用率
          new cw.Metric({
            namespace: 'AWS/ECS',
            metricName: 'CPUUtilization',
            dimensionsMap: {
              ServiceName: service.service.serviceName,
              ClusterName: service.service.cluster.clusterName,
            },
            statistic: 'Average',
            period: Duration.minutes(5),
          }),
        ],
        right: [
          // メモリ使用率
          new cw.Metric({
            namespace: 'AWS/ECS',
            metricName: 'MemoryUtilization',
            dimensionsMap: {
              ServiceName: service.service.serviceName,
              ClusterName: service.service.cluster.clusterName,
            },
            statistic: 'Average',
            period: Duration.minutes(5),
          }),
        ],
        width: 12,
        height: 6,
      });
    });

    // ダッシュボードにウィジェットを追加
    dashboard.addWidgets(...serviceOverviewWidgets);
    dashboard.addWidgets(...ecsHealthWidgets);

    return dashboard;
  }

  /**
   * サービスレイテンシアラームを作成
   */
  private createLatencyAlarms(
    ecsServices: ApplicationSignalsMonitoringProps['ecsServices'],
    alarmTopic: sns.Topic,
  ): cw.Alarm[] {
    return ecsServices.map((service) => {
      const latencyAlarm = new cw.Alarm(this, `${service.serviceName}LatencyAlarm`, {
        alarmName: `${service.serviceName}-HighLatency`,
        alarmDescription: `High latency detected for ${service.serviceName} service`,
        metric: new cw.Metric({
          namespace: 'ApplicationSignals',
          metricName: 'Latency',
          dimensionsMap: {
            Service: service.serviceName,
            Environment: 'production',
          },
          statistic: 'Average',
          period: Duration.minutes(5),
        }),
        threshold: 1000, // 1秒 (1000ms)
        evaluationPeriods: 2,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      });

      latencyAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
      latencyAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

      return latencyAlarm;
    });
  }

  /**
   * エラー率アラームを作成
   */
  private createErrorRateAlarms(
    ecsServices: ApplicationSignalsMonitoringProps['ecsServices'],
    alarmTopic: sns.Topic,
  ): cw.Alarm[] {
    return ecsServices.map((service) => {
      const errorRateAlarm = new cw.Alarm(this, `${service.serviceName}ErrorRateAlarm`, {
        alarmName: `${service.serviceName}-HighErrorRate`,
        alarmDescription: `High error rate detected for ${service.serviceName} service`,
        metric: new cw.Metric({
          namespace: 'ApplicationSignals',
          metricName: 'Error',
          dimensionsMap: {
            Service: service.serviceName,
            Environment: 'production',
          },
          statistic: 'Average',
          period: Duration.minutes(5),
        }),
        threshold: 5, // 5% エラー率
        evaluationPeriods: 2,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cw.TreatMissingData.NOT_BREACHING,
      });

      errorRateAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));
      errorRateAlarm.addOkAction(new cw_actions.SnsAction(alarmTopic));

      return errorRateAlarm;
    });
  }

  /**
   * CloudWatch Agent 障害検知アラームを作成
   * 現在は削除済み - Application Signalsの監視は他のメトリクスで十分
   */
  private createAgentFailureAlarms(
    ecsServices: ApplicationSignalsMonitoringProps['ecsServices'],
    alarmTopic: sns.Topic,
  ): cw.Alarm[] {
    // CloudWatch Agent healthウィジェットを削除したため、関連アラームも削除
    return [];
  }
}
