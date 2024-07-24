import { Construct } from 'constructs';
import { join } from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { ArnFormat, Duration, Stack } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IDatabaseCluster } from 'aws-cdk-lib/aws-rds';

export interface AutomaticSwitchStateMachineProps {
  readonly sourceRegion: string;
  readonly destinationRegion: string;
  readonly sourceParamTable: ITable;
  readonly destinationParamTable: ITable;
  readonly auroraGlobalDatabaseIdentifier: string;
  readonly destinationAuroraCluster: IDatabaseCluster;
  readonly arcClusterEndpoints: string;
  readonly arcClusterEndpointRegions: string;
  readonly sourceRoutingControlArn: string;
  readonly destinationRoutingControlArn: string;
}

/**
 * source regionからdestination regionへ、Activeなリージョンを切り替えるステートマシン
 */
export class AutomaticSwitchStateMachine extends Construct {
  constructor(scope: Construct, id: string, props: AutomaticSwitchStateMachineProps) {
    super(scope, id);

    const proxyHandler = new NodejsFunction(this, 'ProxyHandler', {
      entry: join(__dirname, 'aws-sdk-region-proxy', 'handler.ts'),
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(15),
    });

    props.sourceParamTable.grantWriteData(proxyHandler);
    props.destinationParamTable.grantWriteData(proxyHandler);
    proxyHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['rds:FailoverGlobalCluster'],
        resources: [
          Stack.of(this).formatArn({
            service: 'rds',
            resource: 'global-cluster',
            resourceName: props.auroraGlobalDatabaseIdentifier,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            region: '',
          }),
          Stack.of(props.destinationAuroraCluster).formatArn({
            service: 'rds',
            resource: 'cluster',
            resourceName: props.destinationAuroraCluster.clusterIdentifier,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );
    proxyHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['route53-recovery-cluster:UpdateRoutingControlStates'],
        resources: [props.sourceRoutingControlArn, props.destinationRoutingControlArn],
      }),
    );

    const stopSource = new tasks.LambdaInvoke(this, 'StopSource', {
      lambdaFunction: proxyHandler,
      resultPath: '$.StopSource',
      payload: sfn.TaskInput.fromObject({
        targetRegion: props.sourceRegion,
        service: 'dynamodb',
        action: 'PutItem',
        parameters: {
          TableName: props.sourceParamTable.tableName,
          Item: {
            PK: { S: 'stopFlag' },
            value: { S: 'true' },
          },
        },
      }),
    });

    // 10秒待てばAppTableのstopFlag変更がアプリケーション側に伝わる
    // アプリケーションがstopFlagをTTL=10秒でキャッシュしているため
    const waitX = new sfn.Wait(this, 'WaitForParameterPropagation', {
      time: sfn.WaitTime.duration(Duration.seconds(10)),
    });

    const switchOver = new tasks.LambdaInvoke(this, 'SwitchOver', {
      lambdaFunction: proxyHandler,
      resultPath: '$.SwitchOver',
      payload: sfn.TaskInput.fromObject({
        targetRegion: props.destinationRegion,
        service: 'rds',
        action: 'FailoverGlobalCluster',
        parameters: {
          GlobalClusterIdentifier: props.auroraGlobalDatabaseIdentifier,
          TargetDbClusterIdentifier: Stack.of(props.destinationAuroraCluster).formatArn({
            service: 'rds',
            resource: 'cluster',
            resourceName: props.destinationAuroraCluster.clusterIdentifier,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
          // set this to true for failover
          AllowDataLoss: false,
        },
      }),
    });

    const pollCluster = new tasks.CallAwsService(this, 'DescribeGlobalCluster', {
      service: 'rds',
      action: 'describeGlobalClusters',
      parameters: {
        GlobalClusterIdentifier: props.auroraGlobalDatabaseIdentifier,
      },
      iamResources: [
        Stack.of(this).formatArn({
          service: 'rds',
          resource: 'global-cluster',
          resourceName: props.auroraGlobalDatabaseIdentifier,
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          region: '',
        }),
      ],
      resultPath: '$.polling',
    });

    const startDestination = new tasks.LambdaInvoke(this, 'StartDestination', {
      lambdaFunction: proxyHandler,
      resultPath: '$.StartDestination',
      payload: sfn.TaskInput.fromObject({
        targetRegion: props.destinationRegion,
        service: 'dynamodb',
        action: 'PutItem',
        parameters: {
          TableName: props.destinationParamTable.tableName,
          Item: {
            PK: { S: 'stopFlag' },
            value: { S: 'false' },
          },
        },
      }),
    });

    const choice = new sfn.Choice(this, 'IsClusterAvailable?');
    const condition1 = sfn.Condition.stringEquals('$.polling.GlobalClusters[0].Status', 'available');

    const waitPolling = new sfn.Wait(this, 'Wait Polling', {
      time: sfn.WaitTime.duration(Duration.seconds(10)),
    });

    const poll = pollCluster.next(
      //
      choice
        .when(condition1, startDestination) //
        .otherwise(waitPolling.next(pollCluster)),
    );

    const parseInput = new sfn.Pass(this, 'ParseInput', {
      resultPath: '$.Input',
      parameters: {
        arcEndpointsArray: sfn.JsonPath.stringSplit(props.arcClusterEndpoints, ','),
        arcEndpointRegionsArray: sfn.JsonPath.stringSplit(props.arcClusterEndpointRegions, ','),
        select: sfn.JsonPath.mathRandom(
          0,
          sfn.JsonPath.arrayLength(sfn.JsonPath.stringSplit(props.arcClusterEndpoints, ',')) as unknown as number,
        ),
      },
    });

    const selectEndpoint = new sfn.Pass(this, 'SelectEndpoint', {
      resultPath: '$.Endpoint',
      parameters: {
        arcEndpoint: sfn.JsonPath.arrayGetItem(
          sfn.JsonPath.objectAt('$.Input.arcEndpointsArray'),
          sfn.JsonPath.numberAt('$.Input.select'),
        ),
        arcRegion: sfn.JsonPath.arrayGetItem(
          sfn.JsonPath.objectAt('$.Input.arcEndpointRegionsArray'),
          sfn.JsonPath.numberAt('$.Input.select'),
        ),
      },
    });

    const switchRoute53Arc = new tasks.LambdaInvoke(this, 'SwitchRoute53Arc', {
      lambdaFunction: proxyHandler,
      resultPath: '$.SwitchRoute53Arc',
      payload: sfn.TaskInput.fromObject({
        endpoint: sfn.JsonPath.stringAt('$.Endpoint.arcEndpoint'),
        targetRegion: sfn.JsonPath.stringAt('$.Endpoint.arcRegion'),
        service: 'route53-recovery-cluster',
        action: 'UpdateRoutingControlStates',
        parameters: {
          UpdateRoutingControlStateEntries: [
            {
              RoutingControlArn: props.sourceRoutingControlArn,
              RoutingControlState: 'Off',
            },
            {
              RoutingControlArn: props.destinationRoutingControlArn,
              RoutingControlState: 'On',
            },
          ],
        },
      }),
    });

    const definition = parseInput
      .next(selectEndpoint)
      .next(stopSource)
      .next(waitX)
      .next(switchRoute53Arc)
      .next(switchOver)
      .next(poll);

    new sfn.StateMachine(this, 'StateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: Duration.hours(1),
    });
  }
}
