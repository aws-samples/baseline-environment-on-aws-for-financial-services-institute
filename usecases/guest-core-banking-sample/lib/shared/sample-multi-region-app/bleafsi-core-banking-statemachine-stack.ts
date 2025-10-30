import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackParameter } from '../../../bin/parameter';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { AutomaticSwitchStateMachine } from './automatic-switch-state-machine';
import { FailoverInitiatorStateMachine } from './failover-initiator/failover-initiator-state-machine';
import { EventBridgeRule } from './failover-initiator/event-bridge-rule';
import { CloudWatchAlarm } from './cloud-watch-alarm';

interface CoreBankingStateMachineStackProps extends StackParameter {
  readonly primaryParamTable: ITable;
  readonly secondaryParamTable: ITable;
  readonly auroraGlobalDatabaseIdentifier: string;
  readonly primaryAuroraCluster: IDatabaseCluster;
  readonly secondaryAuroraCluster: IDatabaseCluster;
  readonly arcClusterEndpoints: string;
  readonly arcClusterEndpointRegions: string;
  readonly primaryRoutingControlArn: string;
  readonly secondaryRoutingControlArn: string;
  readonly secondaryCanaryName: string;
  readonly monitoringAlarmName: string;
}

/**
 * BLEA-FSI Core Banking Sample application stack(Resources for automatic failover state machine)
 */
export class CoreBankingStateMachineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CoreBankingStateMachineStackProps) {
    super(scope, id, props);

    const failoverStateMachine = new AutomaticSwitchStateMachine(this, 'FailoverStateMachine', {
      sourceRegion: props.primary.region,
      destinationRegion: props.secondary.region,
      sourceParamTable: props.primaryParamTable,
      destinationParamTable: props.secondaryParamTable,
      auroraGlobalDatabaseIdentifier: props.auroraGlobalDatabaseIdentifier,
      destinationAuroraCluster: props.secondaryAuroraCluster,
      arcClusterEndpoints: props.arcClusterEndpoints,
      arcClusterEndpointRegions: props.arcClusterEndpointRegions,
      sourceRoutingControlArn: props.primaryRoutingControlArn,
      destinationRoutingControlArn: props.secondaryRoutingControlArn,
    });

    const failbackStateMachine = new AutomaticSwitchStateMachine(this, 'FailbackStateMachine', {
      sourceRegion: props.secondary.region,
      destinationRegion: props.primary.region,
      sourceParamTable: props.secondaryParamTable,
      destinationParamTable: props.primaryParamTable,
      auroraGlobalDatabaseIdentifier: props.auroraGlobalDatabaseIdentifier,
      destinationAuroraCluster: props.primaryAuroraCluster,
      arcClusterEndpoints: props.arcClusterEndpoints,
      arcClusterEndpointRegions: props.arcClusterEndpointRegions,
      sourceRoutingControlArn: props.secondaryRoutingControlArn,
      destinationRoutingControlArn: props.primaryRoutingControlArn,
    });

    const cloudWatchAlarm = new CloudWatchAlarm(this, 'CloudWatchAlarm', {
      alarmName: `canaryAlerm-${props.secondary.region}`,
      canaryName: props.secondaryCanaryName,
    });

    const failoverInitiatorStateMachine = new FailoverInitiatorStateMachine(this, 'FailoverInitiatorStateMachine', {
      failoverStateMachineArn: failoverStateMachine.stateMachine.stateMachineArn,
      failbackStateMachineArn: failbackStateMachine.stateMachine.stateMachineArn,
      secondaryRegion: props.secondary.region,
      secondaryAlarmName: cloudWatchAlarm.alarmName,
      monitoringRegion: props.monitoring.region,
      monitoringAlarmName: props.monitoringAlarmName,
    });

    const eventBridgeRule = new EventBridgeRule(this, 'FailoverInitiatorEventBridgeRule', {
      alarmName: cloudWatchAlarm.alarmName,
      failoverInitiatorStateMachineArn: failoverInitiatorStateMachine.stateMachineArn,
    });

    //CFn output
    new cdk.CfnOutput(this, 'Enabling EventBridge rule for auto-failover', {
      value: `aws events enable-rule --name ${eventBridgeRule.ruleName} --region ${props.secondary.region} --profile ct-guest-sso`,
      description: 'Enabling EventBridge rule for auto-failover',
    });
  }
}
