import { FargateTaskDefinition, ICluster } from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationListener,
  ApplicationProtocol,
  ApplicationTargetGroup,
  ListenerCondition,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { CfnOutput, Duration, Stack, aws_ecs as ecs } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IAuroraGlobalCluster } from '../aurora-cluster';
import { IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { addOtel } from './otel';

export interface SampleAppServiceProps {
  cluster: ICluster;
  vpc: IVpc;
  listener: ApplicationListener;
  listenerPath: string;

  /**
   * A positive integer that must be unique within the services sharing the same listener.
   */
  priority: number;
  auroraDatabase?: IAuroraGlobalCluster;
  paramTable?: ITable;
  mainTableName?: string;
  command?: string[];

  /**
   * If set to true, add an ADOT sidecar
   * @default false
   */
  enableAdot?: boolean;
}

export class SampleAppService extends Construct {
  constructor(scope: Construct, id: string, props: SampleAppServiceProps) {
    super(scope, id);

    const { vpc, cluster, listener, listenerPath, paramTable, mainTableName, auroraDatabase } = props;

    const taskDefinition = new FargateTaskDefinition(this, 'Task', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    taskDefinition.addContainer('EcsApp', {
      image: ecs.ContainerImage.fromAsset(`sample-multi-region-app/services/${listenerPath}`, {
        platform: Platform.LINUX_AMD64,
        extraHash: Stack.of(this).region, // https://github.com/aws/aws-cdk/issues/25962
      }),
      environment: {
        MAIN_TABLE_NAME: mainTableName ?? '',
        PARAM_TABLE_NAME: paramTable?.tableName ?? '',
        DATABASE_HOST: auroraDatabase?.host ?? '',
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'BLEA-ECSApp-',
      }),
      command: props.command,
      portMappings: [{ containerPort: 3000 }],
      secrets: {
        ...(auroraDatabase != null
          ? {
              DATABASE_USER: ecs.Secret.fromSecretsManager(auroraDatabase.secret, 'username'),
              DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(auroraDatabase.secret, 'password'),
            }
          : {}),
      },
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
    });

    if (auroraDatabase != null) {
      ecsService.connections.allowToDefaultPort(auroraDatabase?.cluster);
    }
    paramTable?.grantReadData(taskDefinition.taskRole);
    if (mainTableName != null) {
      this.grantReadWriteToDynamoDB(mainTableName, taskDefinition.taskRole);
    }

    const group = new ApplicationTargetGroup(this, 'Group', {
      vpc,
      targets: [ecsService],
      protocol: ApplicationProtocol.HTTP,
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        path: '/health',
        interval: Duration.seconds(15),
        healthyThresholdCount: 2,
      },
    });

    // https://github.com/aws/aws-cdk/issues/4015
    group.setAttribute('deregistration_delay.timeout_seconds', '10');

    const target = listener.addTargetGroups(listenerPath, {
      targetGroups: [group],
      conditions: [ListenerCondition.pathPatterns([`/${listenerPath}*`])],
      priority: props.priority,
    });

    if (props.enableAdot) {
      addOtel(taskDefinition);
    }

    if (auroraDatabase != null) {
      //Primarty Stackのみで出力する
      const regex = /primary/;
      if (regex.test(Stack.of(this).stackName)) {
        new CfnOutput(this, 'MigrationCommand', {
          value: `aws ecs run-task --cluster ${cluster.clusterArn} --task-definition ${
            taskDefinition.taskDefinitionArn
          } --launch-type FARGATE --overrides '{"containerOverrides": [{"name": "EcsApp", "command": ["npx", "prisma", "db", "push"] }]}' --network-configuration "awsvpcConfiguration={subnets=[${
            vpc.isolatedSubnets[0].subnetId
          }],securityGroups=[${ecsService.connections.securityGroups[0].securityGroupId}]}" --region ${
            Stack.of(this).region
          } --profile ct-guest-sso`,
        });
      }
    }
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
