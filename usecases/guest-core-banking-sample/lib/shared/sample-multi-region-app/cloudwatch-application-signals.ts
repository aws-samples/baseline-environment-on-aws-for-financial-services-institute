import { Stack } from 'aws-cdk-lib';
import { TaskDefinition, ContainerImage, LogDriver, Secret } from 'aws-cdk-lib/aws-ecs';
import { PolicyStatement, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { NagSuppressions } from 'cdk-nag';
import { validateResourceConfigurationInDevelopment } from './resource-validation-utils';

/**
 * CloudWatch Application Signals サイドカーコンテナを ECS タスク定義に追加する関数
 *
 * この関数は以下の機能を提供します：
 * - CloudWatch Agent サイドカーコンテナの追加
 * - Application Signals 用の環境変数とコンテナ設定
 * - ヘルスチェック機能とログ設定
 * - 必要な IAM 権限の追加
 *
 * @param taskDefinition - CloudWatch Agent サイドカーを追加する ECS タスク定義
 */
export const addCloudWatchApplicationSignals = (taskDefinition: TaskDefinition) => {
  // ボリュームを追加（OpenTelemetry自動計装用）
  taskDefinition.addVolume({
    name: 'opentelemetry-auto-instrumentation-node',
  });

  // 共有のCloudWatch Agent設定をSSMパラメータから参照
  const parameterName = '/ecs/cloudwatch-agent/application-signals-config';
  const cwAgentConfig = StringParameter.fromStringParameterName(taskDefinition, 'CwAgentConfig', parameterName);
  // Application Signals に必要な権限をタスクロールに追加（正常動作環境と同じ権限）
  const taskRolePolicy = new PolicyStatement({
    actions: [
      // ログ送信権限（Application Signalsで必要）
      'logs:PutLogEvents',
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:DescribeLogStreams',
      'logs:DescribeLogGroups',
      // X-Ray トレース送信（Application Signalsで使用）
      'xray:PutTraceSegments',
      'xray:PutTelemetryRecords',
      'xray:GetSamplingRules',
      'xray:GetSamplingTargets',
      'xray:GetSamplingStatisticSummaries',
      // SSMパラメータアクセス
      'ssm:GetParameters',
    ],
    resources: ['*'],
  });
  taskDefinition.taskRole.addToPrincipalPolicy(taskRolePolicy);

  // cdk-nag抑制: Application Signalsの動作に必要なワイルドカード権限
  NagSuppressions.addResourceSuppressions(taskDefinition.taskRole, [
    {
      id: 'AwsSolutions-IAM5',
      reason:
        'Application Signals requires wildcard permissions for CloudWatch logs, X-Ray traces, and SSM parameters across multiple resources',
      appliesTo: ['Resource::*'],
    },
  ]);

  // Application Signals専用ロググループへの明示的な権限追加
  taskDefinition.taskRole.addToPrincipalPolicy(
    new PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
      ],
      resources: [
        `arn:aws:logs:${Stack.of(taskDefinition).region}:${
          Stack.of(taskDefinition).account
        }:log-group:/aws/application-signals/data:*`,
      ],
    }),
  );

  // SSMパラメータアクセス用の個別権限
  taskDefinition.taskRole.addToPrincipalPolicy(
    new PolicyStatement({
      actions: ['ssm:GetParameters', 'ssm:GetParameter'],
      resources: [cwAgentConfig.parameterArn],
    }),
  );

  // 実行ロールが存在することを確認
  // FargateTaskDefinitionは自動的に実行ロールを作成するが、アクセス時に初期化される
  // 最初にアクセスして実行ロールの作成を強制する
  const executionRole = taskDefinition.obtainExecutionRole();
  if (!executionRole) {
    throw new Error('Failed to obtain executionRole for TaskDefinition');
  }

  // CloudWatch Agent 権限を実行ロールに追加
  // 正常動作環境と同じ AWS 管理ポリシーを追加
  const managedPolicy = ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy');
  executionRole.addManagedPolicy(managedPolicy);

  // cdk-nag抑制: CloudWatch Agent用のAWS管理ポリシーは必要
  NagSuppressions.addResourceSuppressions(executionRole, [
    {
      id: 'AwsSolutions-IAM4',
      reason: 'CloudWatch Agent requires AWS managed policy CloudWatchAgentServerPolicy for proper operation',
      appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/CloudWatchAgentServerPolicy'],
    },
  ]);

  // ECR Public アクセス権限を実行ロールに追加
  // CloudWatch Agent イメージを ECR Public から取得するために必要
  const ecrPublicPolicy = new PolicyStatement({
    actions: ['ecr-public:GetAuthorizationToken', 'sts:GetServiceBearerToken'],
    resources: ['*'],
  });
  executionRole.addToPrincipalPolicy(ecrPublicPolicy);

  // cdk-nag抑制: ECR Publicアクセスには*リソースが必要
  NagSuppressions.addResourceSuppressions(executionRole, [
    {
      id: 'AwsSolutions-IAM5',
      reason: 'ECR Public access requires wildcard permissions for authentication tokens',
      appliesTo: ['Resource::*'],
    },
  ]);

  // 実行ロールにSSMパラメータアクセス権限を追加
  // CloudWatch AgentがsecretsセクションでSSMパラメータにアクセスするために必要
  executionRole.addToPrincipalPolicy(
    new PolicyStatement({
      actions: ['ssm:GetParameters', 'ssm:GetParameter'],
      resources: [cwAgentConfig.parameterArn],
    }),
  );

  // Application Signals用の追加権限を実行ロールに追加
  // 正常動作環境の FSI-corebanking-add-for-appsignals ポリシー相当
  const appSignalsPolicy = new PolicyStatement({
    actions: [
      // Application Signals関連権限
      'application-signals:*',
      // CloudWatch メトリクス送信
      'cloudwatch:PutMetricData',
      // SSMパラメータアクセス（CloudWatch Agent設定用）
      'ssm:GetParameters',
      'ssm:GetParameter',
    ],
    resources: ['*'],
  });
  executionRole.addToPrincipalPolicy(appSignalsPolicy);

  // cdk-nag抑制: Application Signalsの動作に必要なワイルドカード権限
  NagSuppressions.addResourceSuppressions(executionRole, [
    {
      id: 'AwsSolutions-IAM5',
      reason: 'Application Signals requires wildcard permissions for metrics and configuration access',
      appliesTo: ['Resource::*'],
    },
  ]);

  // cdk-nag抑制: タスク定義の環境変数使用を許可
  NagSuppressions.addResourceSuppressions(taskDefinition, [
    {
      id: 'AwsSolutions-ECS2',
      reason: 'CloudWatch Application Signals requires environment variables for proper configuration',
    },
  ]);

  // cdk-nag抑制: 実行ロールのデフォルトポリシーのワイルドカード権限を許可
  // 実行ロールのデフォルトポリシーは自動生成されるため、後で抑制する
  // この抑制は、実行ロールにポリシーが追加された後に適用される

  // initコンテナを追加（OpenTelemetry自動計装をダウンロード）
  // AWS公式ドキュメントに従って、正しいタグを使用
  const initContainer = taskDefinition.addContainer('init', {
    image: ContainerImage.fromRegistry('public.ecr.aws/aws-observability/adot-autoinstrumentation-node:v0.7.0'),
    essential: false,
    // OpenTelemetry自動計装ファイルを共有ボリュームにコピー
    command: ['cp', '-a', '/autoinstrumentation/.', '/otel-auto-instrumentation-node/'],
    logging: LogDriver.awsLogs({
      streamPrefix: 'BLEA-Init-',
    }),
    // initコンテナは短時間で完了するため、最小限のリソースを割り当て
    cpu: 64,
    memoryReservationMiB: 64,
    memoryLimitMiB: 128,
  });

  // initコンテナにボリュームマウントを追加
  initContainer.addMountPoints({
    sourceVolume: 'opentelemetry-auto-instrumentation-node',
    containerPath: '/otel-auto-instrumentation-node',
    readOnly: false,
  });

  // CloudWatch Agent サイドカーコンテナを追加
  // 正常動作環境の設定をベースにパブリックECRで動作するように調整
  taskDefinition.addContainer('ecs-cwagent', {
    // パブリックECRのCloudWatch Agentイメージを使用
    image: ContainerImage.fromRegistry(
      process.env.CLOUDWATCH_AGENT_IMAGE || 'public.ecr.aws/cloudwatch-agent/cloudwatch-agent:1.300059.0b1207',
    ),

    // 正常動作環境と同じCPU設定（cpu: 0 = 未指定）
    cpu: 0,

    // サイドカーコンテナなので、essential: true に設定（正常動作環境に合わせる）
    essential: true,

    // 正常動作環境では起動コマンドを指定していない（デフォルトを使用）
    // command は指定しない

    // Application Signals を有効にするための環境変数設定
    environment: {
      ECS_ENABLE_CONTAINER_METADATA: 'true',
      // Application Signals を有効化
      OTEL_AWS_APPLICATION_SIGNALS_ENABLED: 'true',
      // メトリクスエクスポーターはnoneに設定（Application Signalsが独自に処理）
      OTEL_METRICS_EXPORTER: 'none',
      // OTLPエンドポイントを設定（CloudWatch Agentサイドカー）
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4316',
      // リソース属性を設定（サービス名）
      OTEL_RESOURCE_ATTRIBUTES: `service.name=${Stack.of(taskDefinition).stackName}`,
    },

    // 正常動作環境と同じようにSSMパラメータから設定を取得
    secrets: {
      CW_CONFIG_CONTENT: Secret.fromSsmParameter(cwAgentConfig),
    },

    // 正常動作環境ではポートマッピングなし
    // portMappings: [],

    // 独自のログ設定（正常動作環境と同じ名前にする必要はない）
    logging: LogDriver.awsLogs({
      streamPrefix: 'BLEA-CloudWatchAgent-',
    }),

    // 正常動作環境ではヘルスチェックなし
    // healthCheck は削除
  });

  // cdk-nag抑制: CloudWatch Agentの動作に必要な環境変数
  NagSuppressions.addResourceSuppressions(taskDefinition, [
    {
      id: 'AwsSolutions-ECS2',
      reason: 'CloudWatch Agent requires environment variables for Application Signals configuration',
    },
  ]);

  // 開発時のリソース設定検証（本番環境では無効化可能）
  if (process.env.CDK_DEBUG === 'true') {
    validateResourceConfigurationInDevelopment(taskDefinition);
  }
};
