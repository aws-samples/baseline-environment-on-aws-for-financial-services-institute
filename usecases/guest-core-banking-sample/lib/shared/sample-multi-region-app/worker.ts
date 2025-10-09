import { FargateTaskDefinition, ICluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { Stack, aws_ecs as ecs } from 'aws-cdk-lib';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { addCloudWatchApplicationSignals } from './cloudwatch-application-signals';
import { NagSuppressions } from 'cdk-nag';

export interface SampleAppWorkerProps {
  cluster: ICluster;
  vpc: IVpc;
  paramTable: ITable;
  mainTableName: string;
  balanceEndpoint: string;
  countEndpoint: string;

  /**
   * If set to true, add CloudWatch Application Signals sidecar
   * @default false
   */
  enableApplicationSignals?: boolean;
}

export class SampleAppWorker extends Construct {
  public readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: SampleAppWorkerProps) {
    super(scope, id);

    const { vpc, cluster, paramTable, mainTableName } = props;

    const taskDefinition = new FargateTaskDefinition(this, 'Task', {
      cpu: 1024,
      memoryLimitMiB: 2048,
    });

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
      image: ecs.ContainerImage.fromAsset(`sample-multi-region-app/services/transaction`, {
        platform: Platform.LINUX_AMD64,
        extraHash: Stack.of(this).region,
      }),
      // リソース配分: 1024 CPU / 2048 MiB 環境でアプリケーションに適切なリソースを割り当て
      // Application Signals有効時: アプリケーション 768 CPU / 1792 MiB, CloudWatch Agent 192 CPU / 192 MiB, init 64 CPU / 64 MiB
      // Application Signals無効時: アプリケーション 1024 CPU / 2048 MiB
      cpu: props.enableApplicationSignals ? 768 : 1024,
      memoryReservationMiB: props.enableApplicationSignals ? 1792 : 2048,
      memoryLimitMiB: props.enableApplicationSignals ? 1792 : 2048,
      essential: true,
      environment: {
        MAIN_TABLE_NAME: mainTableName,
        PARAM_TABLE_NAME: paramTable.tableName,
        BALANCE_ENDPOINT: props.balanceEndpoint,
        COUNT_ENDPOINT: props.countEndpoint,
        SERVICE_NAME: 'transaction-worker',
        // Application Signals用のOpenTelemetry環境変数（AWS公式ドキュメント準拠）
        ...(props.enableApplicationSignals
          ? {
              // サービス識別用のリソース属性
              OTEL_RESOURCE_ATTRIBUTES:
                'service.name=transaction-worker,deployment.environment=production,service.version=1.0.0',
              // Application Signals を有効化
              OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
              // メトリクスとログのエクスポーターを無効化（Application Signalsが処理）
              OTEL_METRICS_EXPORTER: 'none',
              OTEL_LOGS_EXPORTER: 'none',
              // トレースエクスポーターの設定
              OTEL_TRACES_EXPORTER: 'otlp',
              OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
              OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4316',
              // X-Ray プロパゲーターを使用
              OTEL_PROPAGATORS: 'xray',
              // Node.js自動計装の有効化
              NODE_OPTIONS: '--require /otel-auto-instrumentation-node/autoinstrumentation.js',
              // サンプリング設定（本番環境では適切な値に調整）
              OTEL_TRACES_SAMPLER: 'xray',
            }
          : {}),
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'BLEA-ECSApp-',
      }),
      command: ['node', 'worker.js'],
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
    this.service = ecsService;

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
