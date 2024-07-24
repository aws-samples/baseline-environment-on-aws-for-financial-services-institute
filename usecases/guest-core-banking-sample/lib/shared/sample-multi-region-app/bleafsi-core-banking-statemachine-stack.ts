import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackParameter } from '../../../bin/parameter';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { AutomaticSwitchStateMachine } from './automatic-switch-state-machine';

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
}

/**
 * BLEA-FSI Core Banking Sample application stack(Resources for automatic failover state machine)
 */
export class CoreBankingStateMachineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CoreBankingStateMachineStackProps) {
    super(scope, id, props);

    new AutomaticSwitchStateMachine(this, 'FailoverStateMachine', {
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

    new AutomaticSwitchStateMachine(this, 'FailbackStateMachine', {
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
  }
}
