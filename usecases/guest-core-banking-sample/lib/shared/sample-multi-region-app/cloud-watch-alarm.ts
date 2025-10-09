import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export interface CloudWatchAlarmProps {
  readonly alarmName: string;
  readonly canaryName: string;
}

export class CloudWatchAlarm extends Construct {
  readonly alarmName: string;

  constructor(scope: Construct, id: string, props: CloudWatchAlarmProps) {
    super(scope, id);

    const cloudWatchAlarm = new cloudwatch.Alarm(this, 'CanaryToTokyoAlarm', {
      alarmName: props.alarmName,
      actionsEnabled: true,
      metric: new cloudwatch.Metric({
        metricName: 'SuccessPercent',
        namespace: 'CloudWatchSynthetics',
        dimensionsMap: {
          CanaryName: props.canaryName,
        },
        statistic: 'Average',
        period: cdk.Duration.seconds(60),
      }),
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      threshold: 100,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.MISSING,
    });

    this.alarmName = cloudWatchAlarm.alarmName;
  }
}
