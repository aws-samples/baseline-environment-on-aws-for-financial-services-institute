import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { aws_route53resolver as route53resolver } from 'aws-cdk-lib';
import { RegionEnv } from 'bin/parameter';
import { CrossRegionSsmParam } from './cross-region-ssm-param';

/*
 * VPC、Transit Gateway、Transit Gateway Attachment、Route 53 Resolverの作成
 */

export interface VpcConstructProps {
  regionEnv: RegionEnv;
  oppositeRegionCidrs: string[];
}

export class Vpc extends Construct {
  public readonly myVpc: ec2.Vpc;
  public readonly tgw: ec2.CfnTransitGateway;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    // VPC
    const myVpc = new ec2.Vpc(this, 'Default', {
      ipAddresses: ec2.IpAddresses.cidr(props.regionEnv.vpcCidr),
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

    // Transit Gateway Attachment to VPC
    const tgwAttachment = new ec2.CfnTransitGatewayAttachment(this, 'TgwAttachment', {
      transitGatewayId: this.tgw.ref,
      vpcId: myVpc.vpcId,
      subnetIds: myVpc.selectSubnets({ subnetGroupName: 'ForTgwAttachments' }).subnetIds,
    });

    props.oppositeRegionCidrs.forEach((cidr, j) => {
      myVpc.publicSubnets.forEach((subnet, i) => {
        new ec2.CfnRoute(this, `PublicRouteToTgw-${j}-${i}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: cidr,
          transitGatewayId: this.tgw.ref,
        }).addDependency(tgwAttachment);
      });

      myVpc.isolatedSubnets.forEach((subnet, i) => {
        new ec2.CfnRoute(this, `IsolatedRouteToTgw-${j}-${i}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: cidr,
          transitGatewayId: this.tgw.ref,
        }).addDependency(tgwAttachment);
      });
    });

    // Route 53 resolver endpoints
    const OnPremCidr = '10.0.0.0/16'; // 環境に合わせて変更してください
    const r53ResolverEndpointSg = new ec2.SecurityGroup(this, 'R53ResolverEndpointSg', {
      vpc: myVpc,
      allowAllOutbound: false,
    });
    r53ResolverEndpointSg.addIngressRule(ec2.Peer.ipv4(OnPremCidr), ec2.Port.tcp(53));

    new route53resolver.CfnResolverEndpoint(this, 'R53ResolverEndpoint', {
      direction: 'INBOUND',
      ipAddresses: myVpc.isolatedSubnets.map((subnet) => ({
        subnetId: subnet.subnetId,
      })),
      securityGroupIds: [r53ResolverEndpointSg.securityGroupId],
    });

    //VPC Flow log
    new VpcFlowLogs(this, 'VpcFlowLogs', myVpc, logs.RetentionDays.SIX_MONTHS);

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

    // Secrets Manager VPC endpoint
    myVpc.addInterfaceEndpoint('SecretsManagerEndpointForPrivate', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // DynamoDB VPC endpoint
    myVpc.addGatewayEndpoint('DynamoDbEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });

    // CloudWatch Logs VPC endpoint
    myVpc.addInterfaceEndpoint('LogsEndpointForPrivate', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    // VPC endpoints for ECR
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

  // SSM Parameter to put Transit Gateway ID
  addTgwIdToSsmParam(paramName: string, baseRegion: string, envName: string): void {
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam-addTgwId', {
      baseRegion,
      envName,
    });
    crossRegionSsmParam.put(paramName, this.tgw.ref);
  }

  // Create Transit Gateway Peering Attachment
  createTgwPeeringAttachment(
    peerTgwIdParamName: string,
    baseRegion: string,
    envName: string,
    peerRegion: string,
  ): string {
    // SSM Parameter to get peer TGW ID
    const crossRegionSsmParamToGetPeerTgwId = new CrossRegionSsmParam(this, 'crossRegionSsmParam-peerTgwId', {
      baseRegion,
      envName,
    });
    const peerTgwId = crossRegionSsmParamToGetPeerTgwId.get(peerTgwIdParamName);

    // TGW Peering Attachment
    const createTgwPeeringAttachment = new cr.AwsCustomResource(this, 'createTgwPeeringAttachment', {
      onUpdate: {
        service: 'EC2',
        action: 'createTransitGatewayPeeringAttachment',
        parameters: {
          PeerAccountId: cdk.Stack.of(this).account,
          PeerRegion: peerRegion,
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
    // TGW Peering Attachment ID
    const tgwPeeringAttachmentId = createTgwPeeringAttachment.getResponseField(
      'TransitGatewayPeeringAttachment.TransitGatewayAttachmentId',
    );

    return tgwPeeringAttachmentId;
  }

  //get Transite Gateway route table id
  getTgwRouteTableId(scope?: Construct) {
    const myScope = scope ?? this;
    const getDefaultRouteTableId = new cr.AwsCustomResource(myScope, 'GetDefaultRouteTableId', {
      onUpdate: {
        service: 'EC2',
        action: 'describeTransitGateways',
        parameters: {
          TransitGatewayIds: [this.tgw.ref],
        },
        physicalResourceId: cr.PhysicalResourceId.of('GetDefaultRouteTableId'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
    const routeTableId = getDefaultRouteTableId.getResponseField(
      'TransitGateways.0.Options.AssociationDefaultRouteTableId',
    );
    return routeTableId;
  }
}

/*
 * VPC Flow Logsの作成
 */
class VpcFlowLogs extends Construct {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, flowLogsRetentionDays: logs.RetentionDays) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: flowLogsRetentionDays,
    });

    const role = new iam.Role(this, 'LogRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new ec2.FlowLog(this, 'VpcFlowLogs', {
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup, role),
    });
  }
}
