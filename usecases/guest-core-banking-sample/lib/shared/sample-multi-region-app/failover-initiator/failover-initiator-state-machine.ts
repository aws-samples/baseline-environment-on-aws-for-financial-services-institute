import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';

/**
 * BLEA-FSI Core Banking Sample application stack (Resources for failover initiator state machine)
 */
export interface FailoverInitiatorStateMachineProps {
  readonly failoverStateMachineArn: string;
  readonly failbackStateMachineArn: string;
  readonly secondaryRegion: string;
  readonly secondaryAlarmName: string;
  readonly monitoringRegion: string;
  readonly monitoringAlarmName: string;
}

export class FailoverInitiatorStateMachine extends Construct {
  readonly stateMachineArn: string;

  constructor(scope: Construct, id: string, props: FailoverInitiatorStateMachineProps) {
    super(scope, id);

    // check_running_status
    const checkRunningStatusLambda = new lambda.Function(this, 'CheckRunningStatusLambda', {
      functionName: 'check_running_status',
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset('lib/shared/sample-multi-region-app/failover-initiator/lambda/check_running_status'),
      handler: 'app.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        failoverStateMachineArn: props.failoverStateMachineArn,
        failbackStateMachineArn: props.failbackStateMachineArn,
      },
    });
    checkRunningStatusLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['states:ListExecutions'],
        resources: [props.failoverStateMachineArn, props.failbackStateMachineArn],
      }),
    );

    // check_running_status
    const checkTwoRegionAlarmsLambda = new lambda.Function(this, 'CheckTwoRegionAlarmsLambda', {
      functionName: 'check_two_region_alarms',
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(
        'lib/shared/sample-multi-region-app/failover-initiator/lambda/check_two_region_alarms',
      ),
      handler: 'app.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        secondaryRegion: props.secondaryRegion,
        secondaryAlarmName: props.secondaryAlarmName,
        monitoringRegion: props.monitoringRegion,
        monitoringAlarmName: props.monitoringAlarmName,
      },
    });
    checkTwoRegionAlarmsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:DescribeAlarms'],
        resources: ['*'],
      }),
    );

    // Step Functions タスクの定義
    const checkRunningStatus = new tasks.LambdaInvoke(this, 'CheckRunningStatus', {
      lambdaFunction: checkRunningStatusLambda,
      resultPath: '$.check',
      payloadResponseOnly: true,
    });

    const checkAlarms = new tasks.LambdaInvoke(this, 'CheckAlarms', {
      lambdaFunction: checkTwoRegionAlarmsLambda,
      resultPath: '$.alarmResult',
      payloadResponseOnly: true,
    });

    const invokeFailoverStateMachine = new tasks.StepFunctionsStartExecution(this, 'InvokeFailoverStateMachine', {
      stateMachine: sfn.StateMachine.fromStateMachineArn(this, 'FailoverStateMachine', props.failoverStateMachineArn),
      input: sfn.TaskInput.fromObject({
        triggeredBy: 'AlarmMonitor',
        alarmResult: sfn.JsonPath.objectAt('$.alarmResult'),
      }),
    });

    // 失敗状態の定義
    const exitWithoutTrigger = new sfn.Fail(this, 'ExitWithoutTrigger', {
      error: 'ConcurrentExecutionDetected',
      cause: 'Either StateMachine for failover or failback is already running.',
    });

    const giveUp = new sfn.Fail(this, 'GiveUp', {
      error: 'MaxRetriesExceeded',
      cause: 'Both alarms not in ALARM state within 6 attempts.',
    });

    // 初期化ステップ
    const initialize = new sfn.Pass(this, 'Initialize', {
      result: sfn.Result.fromNumber(0),
      resultPath: '$.retryCount',
    });

    // 待機ステップ
    const wait10Seconds = new sfn.Wait(this, 'Wait10Seconds', {
      time: sfn.WaitTime.duration(Duration.seconds(10)),
    });

    // リトライカウンタの増加
    const incrementRetry = new sfn.Pass(this, 'IncrementRetry', {
      parameters: {
        'retryCount.$': 'States.MathAdd($.retryCount, 1)',
      },
    });

    // 条件分岐の定義
    const areBothIdle = new sfn.Choice(this, 'AreBothIdle');
    const alarmCheckChoice = new sfn.Choice(this, 'AlarmCheckChoice');
    const retryCheck = new sfn.Choice(this, 'RetryCheck');

    // ワークフローの定義
    checkRunningStatus.next(areBothIdle);

    areBothIdle.when(sfn.Condition.booleanEquals('$.check.bothIdle', true), initialize).otherwise(exitWithoutTrigger);

    initialize.next(checkAlarms);
    checkAlarms.next(alarmCheckChoice);

    alarmCheckChoice
      .when(sfn.Condition.booleanEquals('$.alarmResult.bothInAlarm', true), invokeFailoverStateMachine)
      .otherwise(wait10Seconds);

    wait10Seconds.next(incrementRetry);
    incrementRetry.next(retryCheck);

    retryCheck.when(sfn.Condition.numberLessThanEquals('$.retryCount', 10), checkAlarms).otherwise(giveUp);

    // ステートマシンの作成
    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(checkRunningStatus),
      timeout: Duration.minutes(30),
      comment: 'Check both region alarms and invoke another state machine if needed',
    });

    this.stateMachineArn = stateMachine.stateMachineArn;
  }
}
