import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IsolationStackProps } from './types';
import { SnsNotification } from './sns-notification';
import { IsolationLambda } from './isolation-lambda';
import { GuardDutyEventBridge } from './guardduty-eventbridge';

export class IsolationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IsolationStackProps) {
    super(scope, id, props);

    // SNS通知設定
    const snsNotification = new SnsNotification(this, 'SnsNotification', {
      notifyEmail: props.notifyEmail,
      envName: props.envName,
    });

    // Lambda関数
    const isolationLambda = new IsolationLambda(this, 'IsolationLambda', {
      vpc: props.vpc,
      snsTopicArn: snsNotification.topic.topicArn,
      envName: props.envName,
    });

    // GuardDuty + EventBridge設定
    const guardDutyEventBridge = new GuardDutyEventBridge(this, 'GuardDutyEventBridge', {
      isolationLambdaArn: isolationLambda.function.functionArn,
    });

    // EventBridgeからLambda関数を呼び出す権限を付与
    isolationLambda.function.addPermission('AllowEventBridgeInvoke', {
      principal: new cdk.aws_iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: guardDutyEventBridge.rule.ruleArn,
    });

    // スタック出力
    new cdk.CfnOutput(this, 'IsolationLambdaArn', {
      value: isolationLambda.function.functionArn,
      description: 'ARN of the network isolation Lambda function',
    });

    new cdk.CfnOutput(this, 'SnsTopicArn', {
      value: snsNotification.topic.topicArn,
      description: 'ARN of the SNS topic for isolation notifications',
    });

    new cdk.CfnOutput(this, 'EventBridgeRuleArn', {
      value: guardDutyEventBridge.rule.ruleArn,
      description: 'ARN of the EventBridge rule for GuardDuty findings',
    });
  }
}
