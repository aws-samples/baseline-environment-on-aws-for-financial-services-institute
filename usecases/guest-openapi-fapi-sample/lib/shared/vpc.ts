import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/**
 * VPC Construct
 */
export class Vpc extends Construct {
  public readonly vpc: ec2.Vpc;

  /**
   * constructor
   *
   * @param vpcCidr: 作成するVPCのCIDR Block
   */
  constructor(scope: Construct, id: string, vpcCidr: string) {
    super(scope, id);

    const myVpc = new ec2.Vpc(this, 'Default', {
      ipAddresses: ec2.IpAddresses.cidr(vpcCidr),
      maxAzs: 2,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: 24, // NATGW and NLB
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24, // ECS Fargate Tasks
          name: 'Protected',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24, // Aurora MySQL Cluster
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 28,
          name: 'ForTgwAttachments', // Reservation for future enhancement
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    //  --------------------------------------------------------------
    //  Bucket for VPC Flow logs

    // CMK
    const flowLogKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'VPC Flow logs Bucket',
      alias: `${id}-for-flowlog`,
    });
    flowLogKey.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        resources: ['*'],
      }),
    );

    // Bucket
    const flowLogBucket = new s3.Bucket(this, 'VpcFlowLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryptionKey: flowLogKey,
      encryption: s3.BucketEncryption.KMS,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });

    myVpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(flowLogBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    printOutput(this, 'VpcFlowLogBucketOutput', flowLogBucket.bucketArn);

    //-------------------------------------
    // NACL for Public Subnets
    const naclPublic = new ec2.NetworkAcl(this, 'NaclPublic', {
      vpc: myVpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Egress Rules for Public Subnets
    // naclPublic.addEntry('NaclEgressPublic', {
    //     direction: ec2.TrafficDirection.EGRESS,
    //     ruleNumber: 100,
    //     cidr: ec2.AclCidr.anyIpv4(),
    //     traffic: ec2.AclTraffic.allTraffic(),
    //     ruleAction: ec2.Action.ALLOW,
    // });
    naclPublic.addEntry('NaclEgressPublic', {
      direction: ec2.TrafficDirection.EGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });

    // Ingress Rules for Public Subnets
    naclPublic.addEntry('NaclIngressPublic', {
      direction: ec2.TrafficDirection.INGRESS,
      ruleNumber: 100,
      cidr: ec2.AclCidr.anyIpv4(),
      traffic: ec2.AclTraffic.allTraffic(),
      ruleAction: ec2.Action.ALLOW,
    });

    //-------------------------------------
    // VPC Endpoint for CloudWatch Logs (access by ECS Fargate Task)
    myVpc.addInterfaceEndpoint('LogsEndpointForPrivate', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // VPC Endpoint for ECR API (access by ECS Fargate Task)
    myVpc.addInterfaceEndpoint('EcrEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // VPC Endpooint for ECR Docker (access by ECS Fargate Task)
    myVpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // VPC Endpoint (Gateway Type) for S3 (access by ECS Fargate Task)
    myVpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });

    this.vpc = myVpc;
  }
}

/**
 * create Output
 * @param scope
 * @param id
 * @param key
 */
function printOutput(scope: Construct, id: string, key: string | number) {
  new cdk.CfnOutput(scope, id, { value: String(key) });
}
