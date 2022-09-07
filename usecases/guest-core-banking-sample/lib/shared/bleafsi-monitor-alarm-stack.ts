import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

interface MonitorAlarmStackProps extends cdk.NestedStackProps {
  notifyEmail: string;
}

export class MonitorAlarmStack extends cdk.NestedStack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitorAlarmStackProps) {
    super(scope, id, props);

    // SNS Topic for Monitoring Alarm
    const topic = new sns.Topic(this, 'MonitorAlarmTopic');
    new sns.Subscription(this, 'MonitorAlarmEmail', {
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
