import { Construct } from 'constructs';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_sns_subscriptions as snsSubscriptions } from 'aws-cdk-lib';
import { SnsNotificationProps } from './types';

export class SnsNotification extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: SnsNotificationProps) {
    super(scope, id);

    // SNS Topic for isolation notifications
    this.topic = new sns.Topic(this, 'IsolationNotificationTopic', {
      topicName: `cyber-resilience-isolation-${props.envName}`,
      displayName: `Cyber Resilience Network Isolation Notifications - ${props.envName}`,
    });

    // Email subscription
    this.topic.addSubscription(new snsSubscriptions.EmailSubscription(props.notifyEmail));
  }
}
