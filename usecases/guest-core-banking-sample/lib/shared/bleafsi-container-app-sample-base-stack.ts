import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { region_info as ri } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';

export interface ContainerAppSampleBaseProps extends cdk.NestedStackProps {
  myVpc: ec2.Vpc;
  webAcl: wafv2.CfnWebACL;
  appKey: kms.IKey;
  imageTag: string;
  repository: ecr.IRepository;
}

export class ContainerAppSampleBaseStack extends cdk.NestedStack {
  public readonly appAlb: elbv2.ApplicationLoadBalancer;
  public readonly appAlbListerner: elbv2.ApplicationListener;
  public readonly appAlbSecurityGroup: ec2.SecurityGroup;
  public readonly webContentsBucket: s3.Bucket;
  public readonly ecsClusterName: string;
  public readonly ecsServiceName: string;
  public readonly appTargetGroupName: string;
  public readonly appServerSecurityGroup: ec2.SecurityGroup;
  public readonly albTgUnHealthyHostCountAlarm: cw.Alarm;
  public readonly ecsTargetUtilizationPercent: number;
  public readonly ecsScaleOnRequestCount: number;

  constructor(scope: Construct, id: string, props: ContainerAppSampleBaseProps) {
    super(scope, id, props);

    // --- Security Groups ---
    //Security Group of ALB for App
    const securityGroupForAlb = new ec2.SecurityGroup(this, 'SgAlb', {
      vpc: props.myVpc,
      allowAllOutbound: true,
    });
    this.appAlbSecurityGroup = securityGroupForAlb;

    // ------------ Application LoadBalancer ---------------
    // ALB for App Server
    const lbForApp = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.myVpc,
      securityGroup: securityGroupForAlb,
      // Specify Public subnet for development purpose
      vpcSubnets: props.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
    });
    this.appAlb = lbForApp;

    const lbForAppListener = lbForApp.addListener('http', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      // In the production environment, set this to `false` use the listener's `connections` object to selectively grant access to the load balancer on the listener port.
      open: true,
    });
    this.appAlbListerner = lbForAppListener;

    // Enabled WAF for ALB
    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: lbForApp.loadBalancerArn,
      webAclArn: props.webAcl.attrArn,
    });

    // Enable ALB Access Logging
    //
    // This bucket can not be encrypted with KMS CMK
    // See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    //
    const albLogBucket = new s3.Bucket(this, 'alb-log-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    lbForApp.setAttribute('access_logs.s3.enabled', 'true');
    lbForApp.setAttribute('access_logs.s3.bucket', albLogBucket.bucketName);

    // Permissions for Access Logging
    //    Why don't use bForApp.logAccessLogs(albLogBucket); ?
    //    Because logAccessLogs add wider permission to other account (PutObject*). S3 will become Noncompliant on Security Hub [S3.6]
    //    See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-s3-6
    //    See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    albLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        // ALB access logging needs S3 put permission from ALB service account for the region
        principals: [new iam.AccountPrincipal(ri.RegionInfo.get(cdk.Stack.of(this).region).elbv2Account)],
        // principals: [new iam.AccountPrincipal(ri.RegionInfo.get(cdk.Stack.of(this).region).elbv2Account)],
        resources: [albLogBucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/*`)],
      }),
    );
    albLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: [albLogBucket.arnForObjects(`AWSLogs/${cdk.Stack.of(this).account}/*`)],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      }),
    );
    albLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetBucketAcl'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: [albLogBucket.bucketArn],
      }),
    );

    // --------------------- Fargate Cluster ----------------------------
    // ---- PreRequesties

    // Role for ECS Agent
    // The task execution role grants the Amazon ECS container and Fargate agents permission to make AWS API calls on your behalf.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html
    const executionRole = new iam.Role(this, `EcsTaskExecutionRole`, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });

    // Role for Container
    // With IAM roles for Amazon ECS tasks, you can specify an IAM role that can be used by the containers in a task.
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html
    const serviceTaskRole = new iam.Role(this, 'EcsServiceTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // SecurityGroup for Fargate service
    // - Inbound access will be added automatically on associating ALB
    // - Outbound access will be used for DB and AWS APIs
    const securityGroupForFargate = new ec2.SecurityGroup(this, 'SgFargate', {
      vpc: props.myVpc,
      allowAllOutbound: true, // for AWS APIs
    });
    this.appServerSecurityGroup = securityGroupForFargate;

    // CloudWatch Logs Group for Container
    const fargateLogGroup = new cwl.LogGroup(this, 'FargateLogGroup', {
      retention: cwl.RetentionDays.THREE_MONTHS,
      encryptionKey: props.appKey,
    });

    // Permission to access KMS Key from CloudWatch Logs
    props.appKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
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
    const ecsCluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.myVpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
    });
    this.ecsClusterName = ecsCluster.clusterName;

    // Task definition
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
    const ecsTask = new ecs.FargateTaskDefinition(this, 'EcsTask', {
      executionRole: executionRole,
      taskRole: serviceTaskRole,
      cpu: 256,
      memoryLimitMiB: 512,
    });

    // Container
    const ecsContainer = ecsTask.addContainer('EcsApp', {
      // -- SAMPLE: if you want to use your ECR repository, you can use like this.
      image: ecs.ContainerImage.fromEcrRepository(props.repository, props.imageTag),

      // -- SAMPLE: if you want to use DockerHub, you can use like this.
      // image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),

      environment: {
        ENVIRONMENT_VARIABLE_SAMPLE_KEY: 'Environment Variable Sample Value',
      },
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
    const ecsService = new ecs.FargateService(this, 'FargateService', {
      cluster: ecsCluster,
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
    this.ecsServiceName = ecsService.serviceName;

    // Define ALB Target Group
    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationTargetGroup.html
    const lbForAppTargetGroup = lbForAppListener.addTargets('EcsApp', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [ecsService],
      deregistrationDelay: cdk.Duration.seconds(30),
    });
    this.appTargetGroupName = lbForAppTargetGroup.targetGroupFullName;
  }
}
