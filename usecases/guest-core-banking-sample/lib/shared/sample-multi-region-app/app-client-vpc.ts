import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { CfnTransitGateway, IVpc, Vpc } from 'aws-cdk-lib/aws-ec2';

export interface ClientVpcProps {
  vpcCidr: string;
  tgwAsn: number;
  transitGateway: CfnTransitGateway;
  parentVpc: IVpc;
  secondaryVpcCidr: string;
}

/**
 * サンプルアプリケーションに接続するクライアントが稼働するVPCを作成
 */
export class ClientVpc extends Construct {
  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props: ClientVpcProps) {
    super(scope, id);

    const myVpc = new ec2.Vpc(this, 'Default', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 26,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 28,
          name: 'ForTgwAttachments',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const tgw = props.transitGateway;

    // Transit Gateway Attachment
    const tgwAttachment = new ec2.CfnTransitGatewayAttachment(this, 'TgwAttachment', {
      transitGatewayId: tgw.ref,
      vpcId: myVpc.vpcId,
      subnetIds: myVpc.selectSubnets({ subnetGroupName: 'ForTgwAttachments' }).subnetIds,
    });

    myVpc.isolatedSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(this, `IsolatedRouteToTgw-${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.parentVpc.vpcCidrBlock,
        transitGatewayId: tgw.ref,
      }).addDependency(tgwAttachment);

      new ec2.CfnRoute(this, `IsolatedRouteToTgw-${i}-Secondary`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.secondaryVpcCidr,
        transitGatewayId: tgw.ref,
      }).addDependency(tgwAttachment);
    });

    myVpc.publicSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(this, `PublicRouteToTgw-${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.parentVpc.vpcCidrBlock,
        transitGatewayId: tgw.ref,
      }).addDependency(tgwAttachment);

      new ec2.CfnRoute(this, `PublicRouteToTgw-${i}-Secondary`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.secondaryVpcCidr,
        transitGatewayId: tgw.ref,
      }).addDependency(tgwAttachment);
    });

    props.parentVpc.publicSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(props.parentVpc, `ClientPublicRouteToTgw-${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.vpcCidr,
        transitGatewayId: tgw.ref,
      }).addDependency(tgwAttachment);
    });

    props.parentVpc.isolatedSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(props.parentVpc, `ClientIsolatedRouteToTgw-${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.vpcCidr,
        transitGatewayId: tgw.ref,
      }).addDependency(tgwAttachment);
    });

    props.parentVpc.privateSubnets.forEach((subnet, i) => {
      new ec2.CfnRoute(props.parentVpc, `ClientPrivateRouteToTgw-${i}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.vpcCidr,
        transitGatewayId: tgw.ref,
      }).addDependency(tgwAttachment);
    });

    //VPC Flow log
    new VpcFlowLogs(this, 'VpcFlowLogs', myVpc, logs.RetentionDays.SIX_MONTHS);

    this.vpc = myVpc;
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
