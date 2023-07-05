import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_events as events } from 'aws-cdk-lib';
import { aws_events_targets as targets } from 'aws-cdk-lib';
import { aws_stepfunctions as sfn } from 'aws-cdk-lib';
import { IamRole } from './constructs/bleafsi-iam-role';

/**
 * EventBridgeスケジュール 作成時のパラメータ
 * @example
 *
 */
export interface EventBridgeScheduleProps {
  /**
   * cron形式で記述した実行スケジュール (時間はUTCで記述)
   * See: [aws-cdk-lib.aws_events](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events.CronOptions.html)
   * @example
   * ```
   * { hour: '12', minute:'0}
   * ```
   */
  schedule: events.CronOptions;
  /**
   * ターゲットのStepFunctions StateMachine
   */
  stateMachine: sfn.StateMachine;
  /**
   * EventBridgeスケジュールの名前
   */
  name: string;
  /**
   * スケジュールの説明
   */
  description?: string;
  /**
   * スケジューラーが実行するターゲットに引き渡す入力
   * @example
   * ```
   * {
   *   'SecredId': 'xxxx'
   * }
   */
  targetInput?: object;
}

/**
 * EventBridgeスケジュールを作成するConstruct
 */
export class EventBridgeSchedule extends Construct {
  readonly rule: events.IRule;
  constructor(scope: Construct, id: string, props: EventBridgeScheduleProps) {
    super(scope, id);

    //propsのデフォルト値
    props.description = props.description ?? '';
    props.targetInput = props.targetInput ?? {};

    //StepFunctions実行用のIAM Role
    const policyStatement = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['states:StartExecution'],
          Resource: [`${props.stateMachine.stateMachineArn}`],
        },
      ],
    };
    const eventBridgeRole = new IamRole(this, 'RoleForStepFunctionsRun', {
      policyStatement: policyStatement,
      servicePrincipal: 'events.amazonaws.com',
    });

    //EventBridge イベントルール
    const rule = new events.Rule(this, 'Rule', {
      ruleName: props.name,
      description: props.description,
      schedule: events.Schedule.cron(props.schedule),
    });

    //See https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events_targets.SfnStateMachine.html
    rule.addTarget(
      new targets.SfnStateMachine(props.stateMachine, {
        role: eventBridgeRole.iamRole,
        input: events.RuleTargetInput.fromObject(props.targetInput),
      }),
    );
    this.rule = rule;
  }
}
