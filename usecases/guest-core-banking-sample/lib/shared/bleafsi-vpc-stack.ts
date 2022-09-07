import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { RegionEnv } from '../shared/bleafsi-types';
import { CrossRegionSsmParamName } from './bleafsi-constants';
import { CrossRegionSsmParam } from './bleafsi-cross-region-ssm-param-stack';

export interface VpcStackProps extends cdk.NestedStackProps {
  regionEnv: RegionEnv;
  oppositeRegionEnv: RegionEnv;
}

export class VpcStack extends cdk.NestedStack {
  public readonly myVpc: ec2.Vpc;
  public readonly tgw: ec2.CfnTransitGateway;
  private readonly oppositeRegionEnv: RegionEnv;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    this.oppositeRegionEnv = props.oppositeRegionEnv;

    const myVpc = new ec2.Vpc(this, 'Vpc', {
      cidr: props.regionEnv.vpcCidr,
      maxAzs: 2,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 22,
          name: 'Protected',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 28,
          name: 'ForTgwAttachments',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Transit Gateway
    this.tgw = new ec2.CfnTransitGateway(this, 'Tgw', {
      amazonSideAsn: props.regionEnv.tgwAsn,
      tags: [{ key: 'Name', value: `tgw-${props.regionEnv.region}` }],
    });

    // Transit Gateway Attachment
    const tgwAttachment = new ec2.CfnTransitGatewayAttachment(this, 'TgwAttachment', {
      transitGatewayId: this.tgw.ref,
      vpcId: myVpc.vpcId,
      subnetIds: myVpc.selectSubnets({ subnetGroupName: 'ForTgwAttachments' }).subnetIds,
    });

    myVpc.publicSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(this, `PublicRouteToTgw-${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.oppositeRegionEnv.vpcCidr,
        transitGatewayId: this.tgw.ref,
      }).addDependsOn(tgwAttachment);
    });

    myVpc.isolatedSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(this, `IsolatedRouteToTgw-${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.oppositeRegionEnv.vpcCidr,
        transitGatewayId: this.tgw.ref,
      }).addDependsOn(tgwAttachment);
    });

    //  --------------------------------------------------------------
    //  Bucket for VPC Flow log

    // CMK
    const flowLogKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for VPC Flow log',
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
    const flowLogBucket = new s3.Bucket(this, 'FlowLogBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      encryptionKey: flowLogKey,
      encryption: s3.BucketEncryption.KMS,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    flowLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowSSLRequestsOnly',
        actions: ['s3:*'],
        effect: iam.Effect.DENY,
        resources: [`arn:aws:s3:::${flowLogBucket.bucketName}`, `arn:aws:s3:::${flowLogBucket.bucketName}/*`],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
        principals: [new iam.StarPrincipal()],
      }),
    );

    myVpc.addFlowLog('FlowLogs', {
      destination: ec2.FlowLogDestination.toS3(flowLogBucket),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });
    this.myVpc = myVpc;

    //  --------------------------------------------------------------

    // NACL for Public Subnets
    const naclPublic = new ec2.NetworkAcl(this, 'NaclPublic', {
      vpc: myVpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Egress Rules for Public Subnets
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

    // VPC Endpoint for DynamoDB
    myVpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });

    // VPC Endpoint for Fargate
    myVpc.addInterfaceEndpoint('LogsEndpointForPrivate', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // VPC Endpoint for ECR
    myVpc.addInterfaceEndpoint('EcrEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
    myVpc.addInterfaceEndpoint('EcrDockerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });
    myVpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });
  }

  addTgwIdToSsmParam(paramName: string, baseRegion: string, envName: string): void {
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam-addTgwId', {
      baseRegion,
      envName,
    });
    crossRegionSsmParam.put(paramName, this.tgw.ref);
  }

  // Create Transit Gateway Peering Attachment
  createTgwPeeringAttachment(peerTgwIdParamName: string, baseRegion: string, envName: string) {
    const crossRegionSsmParamToGetPeerTgwId = new CrossRegionSsmParam(this, 'crossRegionSsmParam-peerTgwId', {
      baseRegion,
      envName,
    });
    const peerTgwId = crossRegionSsmParamToGetPeerTgwId.get(peerTgwIdParamName);

    const createTgwPeeringAttachment = new cr.AwsCustomResource(this, 'createTgwPeeringAttachment', {
      onUpdate: {
        service: 'EC2',
        action: 'createTransitGatewayPeeringAttachment',
        parameters: {
          PeerAccountId: cdk.Stack.of(this).account,
          PeerRegion: this.oppositeRegionEnv.region,
          PeerTransitGatewayId: peerTgwId,
          TransitGatewayId: this.tgw.ref,
        },
        region: cdk.Stack.of(this).region,
        physicalResourceId: cr.PhysicalResourceId.of('createTgwPeeringAttachment'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    const tgwPeeringAttachmentId = createTgwPeeringAttachment.getResponseField(
      'TransitGatewayPeeringAttachment.TransitGatewayAttachmentId',
    );

    const crossRegionSsmParamToPutPeeringAttachmentId = new CrossRegionSsmParam(
      this,
      'crossRegionSsmParam-peeringAttachmentId',
      {
        baseRegion,
        envName,
      },
    );
    crossRegionSsmParamToPutPeeringAttachmentId.put(
      CrossRegionSsmParamName.TGW_PEERING_ATTACHMENT_ID,
      tgwPeeringAttachmentId,
    );
  }
}
