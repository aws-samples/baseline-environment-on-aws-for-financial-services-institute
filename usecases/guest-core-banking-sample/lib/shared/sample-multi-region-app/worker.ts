import { FargateTaskDefinition, ICluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { Stack, aws_ecs as ecs } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { addOtel } from './otel';

export interface SampleAppWorkerProps {
  cluster: ICluster;
  vpc: IVpc;
  paramTable: ITable;
  mainTableName: string;
  balanceEndpoint: string;
  countEndpoint: string;

  /**
   * If set to true, add an ADOT sidecar
   * @default false
   */
  enableAdot?: boolean;
}

export class SampleAppWorker extends Construct {
  constructor(scope: Construct, id: string, props: SampleAppWorkerProps) {
    super(scope, id);

    const { vpc, cluster, paramTable, mainTableName } = props;

    const taskDefinition = new FargateTaskDefinition(this, 'Task', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    taskDefinition.addContainer('EcsApp', {
      image: ecs.ContainerImage.fromAsset(`sample-multi-region-app/services/transaction`, {
        platform: Platform.LINUX_AMD64,
        extraHash: Stack.of(this).region,
      }),
      environment: {
        MAIN_TABLE_NAME: mainTableName,
        PARAM_TABLE_NAME: paramTable.tableName,
        BALANCE_ENDPOINT: props.balanceEndpoint,
        COUNT_ENDPOINT: props.countEndpoint,
        SERVICE_NAME: 'transaction-worker',
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'BLEA-ECSApp-',
      }),
      command: ['node', 'worker.js'],
    });

    // Service
    const ecsService = new ecs.FargateService(this, 'FargateService', {
      cluster,
      taskDefinition,
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE',
          weight: 1,
        },
      ],
      vpcSubnets: vpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      minHealthyPercent: 0,
      desiredCount: 1,
    });

    if (props.enableAdot) {
      addOtel(taskDefinition);
    }

    paramTable.grantReadData(taskDefinition.taskRole);
    this.grantReadWriteToDynamoDB(mainTableName, taskDefinition.taskRole);
  }

  grantReadWriteToDynamoDB(tableName: string, role: IRole) {
    const tableArn = Stack.of(this).formatArn({
      service: 'dynamodb',
      resource: 'table',
      resourceName: tableName,
    });

    role.addToPrincipalPolicy(
      new PolicyStatement({
        actions: [
          'dynamodb:BatchWriteItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:BatchGetItem',
          'dynamodb:GetRecords',
          'dynamodb:GetShardIterator',
          'dynamodb:Query',
          'dynamodb:GetItem',
          'dynamodb:Scan',
          'dynamodb:ConditionCheckItem',
        ],
        resources: [tableArn, `${tableArn}/index/*`],
      }),
    );
  }
}
