import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { FargateTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { addCloudWatchApplicationSignals } from '../lib/shared/sample-multi-region-app/cloudwatch-application-signals';

describe('CloudWatch Application Signals Sidecar', () => {
  let app: App;
  let stack: Stack;
  let taskDefinition: FargateTaskDefinition;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');

    // Create execution role with ECR permissions for public ECR
    const executionRole = new Role(stack, 'ExecutionRole', {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add public ECR permissions to execution role
    executionRole.addToPolicy(
      new PolicyStatement({
        actions: ['ecr-public:GetAuthorizationToken', 'sts:GetServiceBearerToken'],
        resources: ['*'],
      }),
    );

    taskDefinition = new FargateTaskDefinition(stack, 'TestTask', {
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: executionRole,
    });
  });

  test('adds CloudWatch Agent sidecar container correctly', () => {
    // Act
    addCloudWatchApplicationSignals(taskDefinition);

    // Assert
    const template = Template.fromStack(stack);

    // Check that the container is added with correct basic properties
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'ecs-cwagent',
          Image: 'public.ecr.aws/cloudwatch-agent/cloudwatch-agent:1.300059.0b1207',
          Essential: true,
          Cpu: 0,
        }),
      ]),
    });
  });

  test('adds required IAM permissions to execution role', () => {
    // Act
    addCloudWatchApplicationSignals(taskDefinition);

    // Assert
    const template = Template.fromStack(stack);

    // Check that Application Signals permissions are added to execution role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('.*ExecutionRoleDefaultPolicy.*'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith(['application-signals:*']),
            Resource: '*',
          }),
        ]),
      },
    });

    // Check that CloudWatch metrics permissions are added to execution role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('.*ExecutionRoleDefaultPolicy.*'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith(['cloudwatch:PutMetricData']),
            Resource: '*',
          }),
        ]),
      },
    });

    // Check that ECR Public permissions are added to execution role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('.*ExecutionRoleDefaultPolicy.*'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith(['ecr-public:GetAuthorizationToken', 'sts:GetServiceBearerToken']),
          }),
        ]),
      },
    });

    // Check that SSM parameter access is added to task role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('.*TaskRoleDefaultPolicy.*'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith(['ssm:GetParameters', 'ssm:GetParameter']),
          }),
        ]),
      },
    });
  });

  test('execution role has public ECR permissions', () => {
    // Assert
    const template = Template.fromStack(stack);

    // Check that execution role has public ECR permissions
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: ['ecr-public:GetAuthorizationToken', 'sts:GetServiceBearerToken'],
            Resource: '*',
          }),
        ]),
      },
    });
  });

  test('creates container with environment variables and secrets', () => {
    // Act
    addCloudWatchApplicationSignals(taskDefinition);

    // Assert
    const template = Template.fromStack(stack);

    // Check that the container has environment variables and secrets
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'ecs-cwagent',
          Environment: Match.arrayWith([
            Match.objectLike({
              Name: 'ECS_ENABLE_CONTAINER_METADATA',
              Value: 'true',
            }),
          ]),
          Secrets: Match.arrayWith([
            Match.objectLike({
              Name: 'CW_CONFIG_CONTENT',
            }),
          ]),
        }),
      ]),
    });
  });

  test('validates IAM permissions include required actions', () => {
    // Act
    addCloudWatchApplicationSignals(taskDefinition);

    // Assert
    const template = Template.fromStack(stack);

    // Verify that Application Signals permissions are present in execution role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('.*ExecutionRoleDefaultPolicy.*'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith(['application-signals:*']),
            Resource: '*',
          }),
        ]),
      },
    });

    // Verify that CloudWatch metrics permissions are present in execution role
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyName: Match.stringLikeRegexp('.*ExecutionRoleDefaultPolicy.*'),
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith(['cloudwatch:PutMetricData']),
            Resource: '*',
          }),
        ]),
      },
    });
  });

  test('validates resource allocation for 512 CPU / 1024 MiB environment', () => {
    // Act
    addCloudWatchApplicationSignals(taskDefinition);

    // Assert
    const template = Template.fromStack(stack);

    // Check task definition has correct total resources
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '512',
      Memory: '1024',
    });

    // Check CloudWatch Agent sidecar has optimized resource allocation
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'ecs-cwagent',
          Cpu: 0, // No specific CPU allocation (uses remaining)
          Essential: true, // Essential for Application Signals functionality
        }),
      ]),
    });
  });

  test('validates Fargate minimum requirements are met', () => {
    // Act
    addCloudWatchApplicationSignals(taskDefinition);

    // Assert
    const template = Template.fromStack(stack);

    // Verify task definition meets Fargate minimum requirements
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      Cpu: '512', // >= 256 vCPU (minimum)
      Memory: '1024', // >= 512 MiB (minimum)
      RequiresCompatibilities: ['FARGATE'],
    });
  });

  test('validates resource allocation efficiency', () => {
    // Act
    addCloudWatchApplicationSignals(taskDefinition);

    // Assert
    const template = Template.fromStack(stack);

    // Verify efficient resource allocation
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'ecs-cwagent',
          // CloudWatch Agent uses minimal resources with dynamic allocation
          // This provides efficient telemetry collection without fixed resource constraints
          Cpu: 0,
          Essential: true,
        }),
      ]),
    });
  });
});
