import * as cdk from 'aws-cdk-lib';
import {
  aws_chatbot as chatbot,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_iam as iam,
  aws_sns as sns,
  Names,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface MonitoringProps {
  monitoringNotifyEmail: string;
  monitoringSlackWorkspaceId: string;
  monitoringSlackChannelId: string;
  fileSystemId: string;
}

export class Monitoring extends Construct {
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);

    const topic = new sns.Topic(this, 'AlarmTopic');
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );
    this.alarmTopic = topic;

    // Email subscription (skip if empty)
    if (props.monitoringNotifyEmail) {
      new sns.Subscription(this, 'EmailSubscription', {
        topic,
        protocol: sns.SubscriptionProtocol.EMAIL,
        endpoint: props.monitoringNotifyEmail,
      });
    }

    // Chatbot (skip if Slack not configured - Deployment lesson #3)
    if (props.monitoringSlackWorkspaceId && props.monitoringSlackChannelId) {
      const chatbotRole = new iam.Role(this, 'ChatbotRole', {
        assumedBy: new iam.ServicePrincipal('chatbot.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess'),
        ],
      });
      new chatbot.CfnSlackChannelConfiguration(this, 'ChatbotChannel', {
        configurationName: Names.uniqueResourceName(this, {}),
        slackChannelId: props.monitoringSlackChannelId,
        iamRoleArn: chatbotRole.roleArn,
        slackWorkspaceId: props.monitoringSlackWorkspaceId,
        snsTopicArns: [topic.topicArn],
      });
    }

    // Alarm: Throughput Utilization
    const throughputAlarm = new cw.Alarm(this, 'ThroughputAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'FileServerDiskThroughputUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription: 'FSxN throughput > 80%. Runbook: doc/backup-procedures.md#throughput-saturation',
    });
    throughputAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    // Alarm: Storage Capacity
    const storageAlarm = new cw.Alarm(this, 'StorageCapacityAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'StorageCapacityUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription: 'FSxN storage > 80%. Runbook: doc/backup-procedures.md#storage-capacity',
    });
    storageAlarm.addAlarmAction(new cw_actions.SnsAction(topic));

    // Alarm: CPU Utilization
    const cpuAlarm = new cw.Alarm(this, 'CpuAlarm', {
      metric: new cw.Metric({
        namespace: 'AWS/FSx',
        metricName: 'CPUUtilization',
        dimensionsMap: { FileSystemId: props.fileSystemId },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription: 'FSxN CPU > 80%. Runbook: doc/backup-procedures.md#cpu-saturation',
    });
    cpuAlarm.addAlarmAction(new cw_actions.SnsAction(topic));
  }
}
