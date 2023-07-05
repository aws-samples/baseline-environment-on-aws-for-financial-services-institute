import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cwa } from 'aws-cdk-lib';

/**
 * CloudWatch アラーム作成時のパラメータ
 * @example
 *
 */
export interface CloudWatchProps {
  /**
   * アラームの通知先のemailアドレス
   */
  notifyEmail: string;
  /**
   * SNSキュー内のメッセージの暗号化に使われるKMSキー
   */
  kmsKey?: kms.IKey;

  /**
   * 監視対象のロググループ
   */
  logGroup: logs.LogGroup;
}

/**
 * StepFunctions による Glue Job実行時のCloudWatch アラームを作成するConstruct
 */
export class CloudWatchAlarm extends Construct {
  readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: CloudWatchProps) {
    super(scope, id);

    // 1 アラーム通知用 SNS Topic 作成
    if (props.kmsKey != null) {
      this.topic = new sns.Topic(this, 'Default', { masterKey: props.kmsKey });
    } else {
      this.topic = new sns.Topic(this, 'Default');
    }

    new sns.Subscription(this, 'Email', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: this.topic,
    });

    // Allow to publish message from CloudWatch
    this.topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [this.topic.topicArn],
      }),
    );

    this.topic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'EnforcePublishersToUseSSL',
        actions: ['sns:Publish'],
        effect: iam.Effect.DENY,
        resources: [this.topic.topicArn],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
        principals: [new iam.StarPrincipal()],
      }),
    );

    //2 CloudWatchアラーム作成
    const taskFailedMetricFilter = new logs.MetricFilter(this, 'MetricFilterSFnTaskFailed', {
      logGroup: props.logGroup,
      filterPattern: {
        logPatternString: '{($.type=TaskFailed)}',
      },
      metricNamespace: 'GlueJobMetrics',
      metricName: 'SFnTaskFailed',
      metricValue: '1',
    });

    new cw.Alarm(this, 'CWAlarmUnauthorizedAttempts', {
      metric: taskFailedMetricFilter.metric({
        period: cdk.Duration.seconds(60),
        statistic: cw.Stats.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'BLEA for FSI: simple datalake Glue Job run failed',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(this.topic));
  }
}
