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
import { addCloudWatchApplicationSignals } from './cloudwatch-application-signals';
import { NagSuppressions } from 'cdk-nag';

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
   * If set to true, add CloudWatch Application Signals sidecar
   * @default false
   */
  enableApplicationSignals?: boolean;
}

export class SampleAppService extends Construct {
  public readonly service: ecs.FargateService;
  public readonly migrationTaskDefinition?: FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: SampleAppServiceProps) {
    super(scope, id);

    const { vpc, cluster, listener, listenerPath, paramTable, mainTableName, auroraDatabase } = props;

    const taskDefinition = new FargateTaskDefinition(this, 'Task', {
      cpu: 1024,
      memoryLimitMiB: 2048,
    });

    // マイグレーション専用のタスク定義（Application Signalsなし）
    let migrationTaskDefinition: FargateTaskDefinition | undefined;
    if (auroraDatabase != null) {
      migrationTaskDefinition = new FargateTaskDefinition(this, 'MigrationTask', {
        cpu: 1024,
        memoryLimitMiB: 2048,
      });
      this.migrationTaskDefinition = migrationTaskDefinition;
    }

    const containerImage = ecs.ContainerImage.fromAsset(`sample-multi-region-app/services/${listenerPath}`, {
      platform: Platform.LINUX_AMD64,
      extraHash: Stack.of(this).region, // https://github.com/aws/aws-cdk/issues/25962
    });

    const containerEnvironment = {
      MAIN_TABLE_NAME: mainTableName ?? '',
      PARAM_TABLE_NAME: paramTable?.tableName ?? '',
      DATABASE_HOST: auroraDatabase?.host ?? '',
      // Application Signals用のOpenTelemetry環境変数（AWS公式ドキュメント準拠）
      ...(props.enableApplicationSignals
        ? {
            // Application Signals用のOpenTelemetry環境変数（AWS公式ドキュメント準拠）
            OTEL_RESOURCE_ATTRIBUTES: `service.name=${listenerPath},deployment.environment=production,service.version=1.0.0`,
            OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
            OTEL_METRICS_EXPORTER: 'none',
            OTEL_LOGS_EXPORTER: 'none',
            OTEL_TRACES_EXPORTER: 'otlp',
            OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
            OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4316',
            // AWS公式ドキュメント準拠: Node.js用追加設定
            OTEL_NODE_RESOURCE_DETECTORS: 'env,host,os,process',
            OTEL_PROPAGATORS: 'xray',
            NODE_OPTIONS: '--require /otel-auto-instrumentation-node/autoinstrumentation.js',
            OTEL_TRACES_SAMPLER: 'xray',
          }
        : {}),
    };

    const containerSecrets = {
      ...(auroraDatabase != null
        ? {
            DATABASE_USER: ecs.Secret.fromSecretsManager(auroraDatabase.secret, 'username'),
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(auroraDatabase.secret, 'password'),
          }
        : {}),
    };

    // Application Signals を有効化（アプリケーションコンテナの前に実行）
    if (props.enableApplicationSignals) {
      addCloudWatchApplicationSignals(taskDefinition);

      // cdk-nag抑制: 実行ロールのデフォルトポリシーのワイルドカード権限を許可
      const executionRole = taskDefinition.executionRole;
      if (executionRole && executionRole.node.tryFindChild('DefaultPolicy')) {
        NagSuppressions.addResourceSuppressions(executionRole.node.findChild('DefaultPolicy'), [
          {
            id: 'AwsSolutions-IAM5',
            reason:
              'CloudWatch Application Signals execution role requires wildcard permissions for ECR and CloudWatch access',
            appliesTo: ['Resource::*'],
          },
        ]);
      }
    }

    const appContainer = taskDefinition.addContainer('EcsApp', {
      image: containerImage,
      // リソース配分: Application Signals有効時は適切にリソースを分割
      // 1024 CPU / 2048 MiB 環境: アプリ 768 CPU / 1792 MiB, CloudWatch Agent 192 CPU / 192 MiB, init 64 CPU / 64 MiB
      cpu: props.enableApplicationSignals ? 768 : 1024,
      memoryReservationMiB: props.enableApplicationSignals ? 1792 : 2048,
      memoryLimitMiB: props.enableApplicationSignals ? 1792 : 2048,
      essential: true,
      environment: containerEnvironment,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'BLEA-ECSApp-',
      }),
      command: props.command,
      portMappings: [{ containerPort: 3000 }],
      secrets: containerSecrets,
    });

    // Application Signals有効時にボリュームマウントと依存関係を追加
    if (props.enableApplicationSignals) {
      appContainer.addMountPoints({
        sourceVolume: 'opentelemetry-auto-instrumentation-node',
        containerPath: '/otel-auto-instrumentation-node',
        readOnly: false,
      });

      // initコンテナの完了を待つ
      appContainer.addContainerDependencies({
        container: taskDefinition.findContainer('init')!,
        condition: ecs.ContainerDependencyCondition.SUCCESS,
      });

      // CloudWatch Agentコンテナの起動を待つ（正常動作環境に合わせてSTART条件を使用）
      appContainer.addContainerDependencies({
        container: taskDefinition.findContainer('ecs-cwagent')!,
        condition: ecs.ContainerDependencyCondition.START,
      });
    }

    // マイグレーション専用コンテナ（Application Signalsなし）
    if (migrationTaskDefinition != null) {
      migrationTaskDefinition.addContainer('EcsApp', {
        image: containerImage,
        cpu: 1024,
        memoryReservationMiB: 2048,
        memoryLimitMiB: 2048,
        essential: true,
        environment: containerEnvironment,
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: 'BLEA-Migration-',
        }),
        secrets: containerSecrets,
      });

      // cdk-nag抑制: マイグレーションタスクの環境変数使用を許可
      NagSuppressions.addResourceSuppressions(migrationTaskDefinition, [
        {
          id: 'AwsSolutions-ECS2',
          reason: 'Migration task requires environment variables for database connection and configuration',
        },
      ]);

      // cdk-nag抑制: マイグレーションタスクの実行ロールのデフォルトポリシーのワイルドカード権限を許可
      const migrationExecutionRole = migrationTaskDefinition.executionRole;
      if (migrationExecutionRole && migrationExecutionRole.node.tryFindChild('DefaultPolicy')) {
        NagSuppressions.addResourceSuppressions(migrationExecutionRole.node.findChild('DefaultPolicy'), [
          {
            id: 'AwsSolutions-IAM5',
            reason: 'Migration task execution role requires wildcard permissions for CloudWatch Logs access',
            appliesTo: ['Resource::*'],
          },
        ]);
      }
    }

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
    this.service = ecsService;

    if (auroraDatabase != null) {
      ecsService.connections.allowToDefaultPort(auroraDatabase?.cluster);
    }
    paramTable?.grantReadData(taskDefinition.taskRole);
    if (mainTableName != null) {
      this.grantReadWriteToDynamoDB(mainTableName, taskDefinition.taskRole);
    }

    // マイグレーションタスクにも同じ権限を付与
    if (migrationTaskDefinition != null) {
      paramTable?.grantReadData(migrationTaskDefinition.taskRole);
      if (mainTableName != null) {
        this.grantReadWriteToDynamoDB(mainTableName, migrationTaskDefinition.taskRole);
      }
    }

    const group = new ApplicationTargetGroup(this, 'Group', {
      vpc,
      targets: [
        ecsService.loadBalancerTarget({
          containerName: 'EcsApp',
          containerPort: 3000,
        }),
      ],
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

    if (auroraDatabase != null && migrationTaskDefinition != null) {
      //Primarty Stackのみで出力する
      const regex = /primary/;
      if (regex.test(Stack.of(this).stackName)) {
        new CfnOutput(this, 'MigrationCommand', {
          value: `aws ecs run-task --cluster ${cluster.clusterArn} --task-definition ${
            migrationTaskDefinition.taskDefinitionArn
          } --launch-type FARGATE --overrides '{"containerOverrides": [{"name": "EcsApp", "command": ["npx", "prisma", "db", "push"] }]}' --network-configuration "awsvpcConfiguration={subnets=[${
            vpc.privateSubnets[0].subnetId
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
