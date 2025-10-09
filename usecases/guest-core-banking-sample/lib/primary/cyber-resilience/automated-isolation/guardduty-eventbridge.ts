import { Construct } from 'constructs';
import { aws_events as events } from 'aws-cdk-lib';
import { aws_events_targets as targets } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { GuardDutyEventBridgeProps } from './types';

export class GuardDutyEventBridge extends Construct {
  public readonly rule: events.Rule;

  constructor(scope: Construct, id: string, props: GuardDutyEventBridgeProps) {
    super(scope, id);

    // EventBridge Rule for GuardDuty Critical Findings
    this.rule = new events.Rule(this, 'GuardDutyCriticalFindingsRule', {
      ruleName: 'cyber-resilience-guardduty-critical-findings',
      description: 'Trigger network isolation on GuardDuty critical findings (severity >= 9.0)',
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding'],
        detail: {
          severity: [
            { numeric: ['>=', 9.0] }, // Critical severity only (9.0-10.0)
          ],
        },
      },
    });

    // Lambda関数をターゲットとして追加
    this.rule.addTarget(
      new targets.LambdaFunction(
        lambda.Function.fromFunctionArn(this, 'IsolationLambdaTarget', props.isolationLambdaArn),
      ),
    );
  }
}
