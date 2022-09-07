import * as cdk from 'aws-cdk-lib';
import { ContainerAppSampleBaseStack } from './bleafsi-container-app-sample-stack';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { region_info as ri } from 'aws-cdk-lib';

export interface ContainerDistributorAppSampleBaseProps extends cdk.NestedStackProps {
  myVpc: ec2.Vpc;
  appKey: kms.IKey;
  imageTag: string;
  repository: ecr.IRepository;
  webAcl: wafv2.CfnWebACL;
}

export class ContainerDistributorAppSampleStack extends cdk.NestedStack {
  public readonly appAlb: elbv2.ApplicationLoadBalancer;
  public readonly appAlbListerner: elbv2.ApplicationListener;
  public readonly appAlbSecurityGroup: ec2.SecurityGroup;
  public readonly appServerSecurityGroup: ec2.SecurityGroup;
  public readonly appTargetGroupName: string;

  constructor(scope: Construct, id: string, props: ContainerDistributorAppSampleBaseProps) {
    super(scope, id, props);

    const { myVpc, appKey, imageTag, repository } = props;

    const containerappSampleBase = new ContainerAppSampleBaseStack(this, `containerAppSampleBase`, {
      myVpc,
      appKey,
      imageTag,
      repository,
    });

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
    const albLogBucket = new s3.Bucket(this, 'alb-log-bucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    lbForApp.setAttribute('access_logs.s3.enabled', 'true');
    lbForApp.setAttribute('access_logs.s3.bucket', albLogBucket.bucketName);

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

    // Define ALB Target Group
    // https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-elasticloadbalancingv2.ApplicationTargetGroup.html
    const lbForAppTargetGroup = lbForAppListener.addTargets('EcsApp', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [containerappSampleBase.ecsService],
      deregistrationDelay: cdk.Duration.seconds(30),
    });
    this.appTargetGroupName = lbForAppTargetGroup.targetGroupFullName;
    this.appServerSecurityGroup = containerappSampleBase.appServerSecurityGroup;
  }
}
