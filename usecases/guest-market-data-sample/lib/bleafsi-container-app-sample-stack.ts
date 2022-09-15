import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';

export interface ContainerAppSampleBaseProps extends cdk.NestedStackProps {
  myVpc: ec2.Vpc;
  appKey: kms.IKey;
  imageTag: string;
  repository: ecr.IRepository;
}

export class ContainerAppSampleBaseStack extends cdk.NestedStack {
  public readonly ecsCluster: ecs.Cluster;
  public readonly ecsService: ecs.FargateService;
  public readonly ecsClusterName: string;
  public readonly ecsServiceName: string;
  public readonly appTargetGroupName: string;
  public readonly appServerSecurityGroup: ec2.SecurityGroup;
  public readonly ecsTargetUtilizationPercent: number;
  public readonly ecsScaleOnRequestCount: number;

  constructor(scope: Construct, id: string, props: ContainerAppSampleBaseProps) {
    super(scope, id, props);

    // --------------------- Fargate Cluster ----------------------------
    // ---- PreRequesties

    // Role for ECS Agent
    // The task execution role grants the Amazon ECS container and Fargate agents permission to make AWS API calls on your behalf.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html
    const executionRole = new iam.Role(this, `EcsTaskExecutionRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
        resources: [props.repository.repositoryArn],
      }),
    );
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      }),
    );
    executionRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );
    executionRole.withoutPolicyUpdates();

    // Role for Container
    // With IAM roles for Amazon ECS tasks, you can specify an IAM role that can be used by the containers in a task.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
    const serviceTaskRole = new iam.Role(this, 'EcsServiceTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    serviceTaskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'kinesis:GetRecords',
          'kinesis:GetShardIterator',
          'kinesis:DescribeStreamSummary',
          'kinesis:PutRecord',
        ],
        effect: iam.Effect.ALLOW,
        resources: [`arn:aws:kinesis:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:stream/*`],
      }),
    );

    // SecurityGroup for Fargate service
    // - Inbound access will be added automatically on associating ALB
    // - Outbound access will be used for DB and AWS APIs
    const securityGroupForFargate = new ec2.SecurityGroup(this, 'SgFargate', {
      vpc: props.myVpc,
      allowAllOutbound: true, // for AWS APIs
    });
    securityGroupForFargate.addEgressRule(
      ec2.Peer.ipv4('0.0.0.0/0'),
      ec2.Port.tcp(22),
      'exsample description', //インバウンドルールの説明
    );
    securityGroupForFargate.addEgressRule(
      ec2.Peer.ipv4('0.0.0.0/0'),
      ec2.Port.tcp(443),
      'exsample description', //インバウンドルールの説明
    );
    this.appServerSecurityGroup = securityGroupForFargate;

    // CloudWatch Logs Group for Container
    const fargateLogGroup = new cwl.LogGroup(this, 'FargateLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: props.appKey,
    });

    // Permission to access KMS Key from CloudWatch Logs
    props.appKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal(`logs.${cdk.Stack.of(this).region}.amazonaws.com`)],
        resources: ['*'],
        conditions: {
          ArnLike: {
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${cdk.Stack.of(this).region}:${
              cdk.Stack.of(this).account
            }:*`,
          },
        },
      }),
    );
    // ---- Cluster definition

    // Fargate Cluster
    // -  Enabling CloudWatch ContainerInsights
    this.ecsCluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.myVpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });
    this.ecsClusterName = this.ecsCluster.clusterName;

    // Task definition
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
    const ecsTask = new ecs.FargateTaskDefinition(this, 'EcsTask', {
      executionRole: executionRole.withoutPolicyUpdates(),
      taskRole: serviceTaskRole.withoutPolicyUpdates(),
      cpu: 256,
      memoryLimitMiB: 512,
    });

    // Container
    const ecsContainer = ecsTask.addContainer('EcsApp', {
      // -- SAMPLE: if you want to use your ECR repository, you can use like this.
      image: ecs.ContainerImage.fromEcrRepository(props.repository, props.imageTag),

      // -- SAMPLE: if you want to use DockerHub, you can use like this.
      // image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),

      // environment: {
      //   ENVIRONMENT_VARIABLE_SAMPLE_KEY: 'Environment Variable Sample Value',
      // },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'BLEA-ECSApp-',
        logGroup: fargateLogGroup,
      }),
      // -- SAMPLE: Get value from SecretsManager
      // secrets: {
      //   SECRET_VARIABLE_SAMPLE_KEY: ecs.Secret.fromSecretsManager(secretsManagerConstruct, 'secret_key'),
      // },
    });

    ecsContainer.addPortMappings({
      containerPort: 80,
    });

    // Service
    this.ecsService = new ecs.FargateService(this, 'FargateService', {
      cluster: this.ecsCluster,
      taskDefinition: ecsTask,
      desiredCount: 2,

      // The LATEST is recommended platform version.
      // But if you need another version replace this.
      // See also:
      // - https://docs.aws.amazon.com/AmazonECS/latest/userguide/platform_versions.html
      // - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-ecs.FargatePlatformVersion.html
      platformVersion: ecs.FargatePlatformVersion.LATEST,

      // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html#fargate-capacity-providers
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE',
          weight: 1,
        },
        // -- SAMPLE: Fargate Spot
        //{
        //  capacityProvider: 'FARGATE_SPOT',
        //  weight: 2,
        //},
      ],
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      securityGroups: [securityGroupForFargate],
    });
    this.ecsServiceName = this.ecsService.serviceName;
  }
}
