import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NetworkingProps {
  vpcCidr: string;
}

export class Networking extends Construct {
  public readonly vpc: ec2.IVpc;
  public readonly fsxnSecurityGroup: ec2.ISecurityGroup;
  public readonly lambdaSecurityGroup: ec2.ISecurityGroup;
  public readonly privateSubnetRouteTableIds: string[];

  constructor(scope: Construct, id: string, props: NetworkingProps) {
    super(scope, id);

    // VPC with isolated private subnets (no NAT, no IGW)
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ cidrMask: 24, name: 'Private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
      flowLogs: { default: { destination: ec2.FlowLogDestination.toCloudWatchLogs() } },
    });
    this.vpc = vpc;
    this.privateSubnetRouteTableIds = vpc.isolatedSubnets.map((s) => s.routeTable.routeTableId);

    // VPC Endpoints
    vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER });
    vpc.addInterfaceEndpoint('CloudWatchLogsEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS });
    vpc.addInterfaceEndpoint('BackupEndpoint', {
      service: new ec2.InterfaceVpcEndpointService(`com.amazonaws.${cdk.Stack.of(this).region}.backup`),
    });

    // Security Group: FSxN
    const fsxnSg = new ec2.SecurityGroup(this, 'FsxnSecurityGroup', {
      vpc,
      description: 'FSxN SG',
      allowAllOutbound: false,
    });
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(2049), 'NFS');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(445), 'SMB');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(443), 'ONTAP REST API');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(111), 'NFS portmapper');
    fsxnSg.addIngressRule(ec2.Peer.ipv4(props.vpcCidr), ec2.Port.tcp(635), 'NFS mountd');
    this.fsxnSecurityGroup = fsxnSg;

    // Security Group: Lambda (Custom Resource)
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Lambda SG',
      allowAllOutbound: true,
    });
    this.lambdaSecurityGroup = lambdaSg;
  }
}
