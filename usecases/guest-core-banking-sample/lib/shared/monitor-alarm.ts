import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

/*
 * 監視アラーム用のSNSトピックの作成
 */

interface MonitorAlarmConstructProps {
  notifyEmail: string;
}

export class MonitorAlarm extends Construct {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitorAlarmConstructProps) {
    super(scope, id);

    // SNS Topic for Monitoring Alarm
    const topic = new sns.Topic(this, 'Topic');
    new sns.Subscription(this, 'Email', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: topic,
    });
    this.alarmTopic = topic;

    // Allow to publish message from CloudWatch
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );

    // Deny to publish message from CloudWatch if SSL is not used
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'EnforcePublishersToUseSSL',
        actions: ['sns:Publish'],
        effect: iam.Effect.DENY,
        resources: [topic.topicArn],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
        principals: [new iam.StarPrincipal()],
      }),
    );
  }
}
