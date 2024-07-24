import { Duration, Stack } from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { TaskDefinition, ContainerImage, LogDriver, Protocol } from 'aws-cdk-lib/aws-ecs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { join } from 'path';

export const addOtel = (taskDefinition: TaskDefinition) => {
  taskDefinition.taskRole.addToPrincipalPolicy(
    new PolicyStatement({
      actions: [
        'logs:PutLogEvents',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:DescribeLogStreams',
        'logs:DescribeLogGroups',
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
        'xray:GetSamplingStatisticSummaries',
        'ssm:GetParameters',
      ],
      resources: ['*'],
    }),
  );
  taskDefinition.addContainer('otelContainer', {
    image: ContainerImage.fromAsset(join(__dirname, 'adot'), {
      platform: Platform.LINUX_AMD64,
      extraHash: Stack.of(taskDefinition).region,
    }),
    command: ['--config=/etc/ecs/container-insights/otel-task-metrics-config.yaml'],
    essential: true,
    portMappings: [
      {
        containerPort: 4317,
        hostPort: 4317,
        protocol: Protocol.UDP,
      },
      {
        containerPort: 4318,
        hostPort: 4318,
        protocol: Protocol.UDP,
      },
      {
        containerPort: 2000, //xray port
        hostPort: 2000,
        protocol: Protocol.UDP,
      },
      {
        containerPort: 13133, //healthcheck
        hostPort: 13133,
        protocol: Protocol.TCP,
      },
    ],
    healthCheck: {
      command: ['CMD', '/healthcheck'],
      timeout: Duration.seconds(10),
      startPeriod: Duration.seconds(10),
    },
    logging: LogDriver.awsLogs({
      streamPrefix: '/ecs/otel-sidecar-collector',
    }),
  });
};
