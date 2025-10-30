import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';

export interface EventBridgeRuleProps {
  readonly alarmName: string;
  readonly failoverInitiatorStateMachineArn: string;
}

export class EventBridgeRule extends Construct {
  readonly ruleName: string;

  constructor(scope: Construct, id: string, props: EventBridgeRuleProps) {
    super(scope, id);

    const stateMachine = sfn.StateMachine.fromStateMachineArn(
      this,
      'FailoverInitiator',
      props.failoverInitiatorStateMachineArn,
    );

    const eventPattern = {
      source: ['aws.cloudwatch'],
      detailType: ['CloudWatch Alarm State Change'],
      detail: {
        state: {
          value: ['ALARM'],
        },
        previousState: {
          value: ['OK'],
        },
        alarmName: [props.alarmName],
      },
    };

    const rule = new events.Rule(this, 'CloudWatchAlarmRule', {
      eventPattern: eventPattern,
      description: 'Rule to trigger failover when CloudWatch alarm changes to ALARM state',
      enabled: false,
    });

    this.ruleName = rule.ruleName;

    rule.addTarget(new targets.SfnStateMachine(stateMachine));
  }
}
