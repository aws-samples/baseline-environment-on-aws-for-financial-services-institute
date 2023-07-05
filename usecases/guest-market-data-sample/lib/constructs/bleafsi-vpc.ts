// based on /resources/cdk-shared-constructs/lib/bleafsi-vpc.ts@v1.0.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/**
 * VPC作成時のパラメータ
 */

export interface VpcProps {
  /***
   * VPCに指定するIPアドレス範囲（CIDR形式）<br>
   * 最大 /16、最小 /28
   *
   * @defaultValue
   * `10.0.0.0/16`
   */
  vpcIpAddresses?: string;

  /**
   * VPC内に作成するVPC Endpointsを指定
   */
  vpcEndpoints?: VpcEndpointTypeName[];
  /**
   * VPC Flow Logsの保持期間 <br>
   * See: [aws-cdk-lib.aws_logs.RetentionDays](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_logs.RetentionDays.html)
   *
   * @defaultValue
   * 6ヶ月 RetentionDays.SIX_MONTHS
   */
  flowLogsRetentionDays?: logs.RetentionDays;

  /**
   * private subnetのCIDR
   *
   * @defaultValue
   * 24
   */
  privateSubnetCidr?: number;

  /**
   * public subnetのCIDR
   *
   * @defaultValue
   * 24
   */
  publicSubnetCidr?: number;
}

/**
 * 作成するVPC Endpointの種類を指定
 * - S3_Gateway: Gateway タイプの S3用 VPC Endpoints
 * - S3_Interface: Interface タイプの S3用 VPC Endpoints
 * - DynamoDB: Interface タイプの DynamoDB 用 VPC Endpoints
 * - CWLogs: Interface タイプの CloudWatch Logs用 VPC Endpoints
 * - ECR: Interface タイプのECR用 VPC Endpoints
 * - ECR_Docker: Interface タイプの ECR Docker用 VPC Endpoints
 * - SecretsManager: Interface タイプの Secrets Manager用 VPC Endpoints
 * - SSM: SSM接続用の4つのInterface タイプ（SSM, SSM_MESSAGES, EC2, EC2_MESSAGES）のVPC Endpoints
 * - Glue: Interface タイプの Glue用 VPC Endpoints
 * - KMS: Interface タイプの KMS用 VPC Endpoints
 */
export enum VpcEndpointTypeName {
  S3_Gateway = 'S3_Gateway',
  S3_Interface = 'S3_Interface',
  DynamoDB = 'DynamoDB',
  CWLogs = 'CWLogs',
  ECR = 'ECR',
  ECR_Docker = 'ECR_Docker',
  SecretsManager = 'SecretsManager',
  SSM = 'SSM',
  Glue = 'Glue',
  KMS = 'KMS',
}

/**
 * Private SubnetのみのVPCを作成する Construct <br>
 * See [aws-cdk-lib.aws_ec2.Vpc](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html)
 *
 * <img src="../media/PrivateVpc.png">
 * @remarks
 * 下記のリソースを作成する。
 * - 2つのAZに2つのPrivate Subnet
 * - SubnetのCIDRマスクのデフォルトは /24
 * - NACL
 * - VPC FlowLogs（CloudWatch Logsに出力）
 * - 指定されたVPC Endpoints
 *
 * @example vpcEndpoint付きで Private subnet のみを持つVPCを作成
 * ```
 * import { PrivateVpc, VpcEndpointTypeName } from '../lib/bleafsi-vpc';
 *
 * const vpc = new PrivateVpc(this, 'SampleVpc', {
 *   vpcIpAddresses: '10.2.0.0/16',
 *   vpcEndpoints: [VpcEndpointTypeName.CWLogs, VpcEndpointTypeName.DynamoDB],
 * });
 * ```
 */
export class PrivateVpc extends Construct {
  readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props?: VpcProps) {
    super(scope, id);

    //プロパティのデフォルト値設定
    if (props == null) {
      props = {};
    }
    if (props.vpcIpAddresses == null) {
      props.vpcIpAddresses = '10.0.0.0/16';
    }
    if (props.flowLogsRetentionDays == null) {
      props.flowLogsRetentionDays = logs.RetentionDays.SIX_MONTHS;
    }
    if (props.privateSubnetCidr == null) {
      props.privateSubnetCidr = 24;
    }

    //VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcIpAddresses),
      maxAzs: 2,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: props.privateSubnetCidr,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    //  --------------------------------------------------------------
    //VPC Flow log
    new VpcFlowLogs(this, 'VpcFlowLogs', vpc, props);

    //VPC Endpoints
    createVpCEndpoints(vpc, props);

    this.vpc = vpc;
  }
}

/**
 * Public と Private Subnetを持つVPCを作成する Construct <br>
 * See: [aws-cdk-lib.aws_ec2.Vpc](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.Vpc.html)
 *
 * <img src="../media/PublicVpc.png">
 * @remarks
 * 下記のリソースを作成する。
 * - 2つのAZに2つのPrivate Subnet と 2つのPublic Subnet
 * - SubnetのCIDRマスクのデフォルトは /24
 * - Public Subnet/Private Subnet それぞれにNACL
 * - VPC FlowLogs（CloudWatch Logsに出力）
 * - Internet Gateway（Public Subnetに紐付け）
 * - 指定されたVPC Endpoints（Private Subnetに紐付け）
 *
 * @example vpcEndpoint付きで Public と Private subnet を持つVPCを作成
 * ```
 * import { PublicVpc, VpcEndpointTypeName } from '../lib/bleafsi-vpc';
 *
 * const vpc = new PublicVpc(this, 'SampleVpc', {
 *   vpcIpAddresses: '10.0.0.0/16',
 *   vpcEndpoints: [VpcEndpointTypeName.S3_Gateway],
 * });
 * ```
 */
export class PublicVpc extends Construct {
  readonly vpc: ec2.Vpc;
  constructor(scope: Construct, id: string, props?: VpcProps) {
    super(scope, id);

    //プロパティのデフォルト値設定
    props = props ?? {};
    props.vpcIpAddresses = props.vpcIpAddresses ?? '10.0.0.0/16';
    props.flowLogsRetentionDays = props.flowLogsRetentionDays ?? logs.RetentionDays.SIX_MONTHS;
    props.privateSubnetCidr = props.privateSubnetCidr ?? 24;
    props.publicSubnetCidr = props.publicSubnetCidr ?? 24;

    //VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
      ipAddresses: ec2.IpAddresses.cidr(props.vpcIpAddresses),
      maxAzs: 2,
      flowLogs: {},
      subnetConfiguration: [
        {
          cidrMask: props.publicSubnetCidr,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: props.privateSubnetCidr,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    //  --------------------------------------------------------------
    //NACL for public access
    createNACL(this, vpc, props);

    //VPC Flow log
    new VpcFlowLogs(this, 'VpcFlowLogs', vpc, props);

    //VPC Endpoints
    createVpCEndpoints(vpc, props);

    this.vpc = vpc;
  }
}

////// private Constructs and Functions //////////
/*
 * VPC Flow Logsの作成
 */
class VpcFlowLogs extends Construct {
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, props: VpcProps) {
    super(scope, id);

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      retention: props.flowLogsRetentionDays,
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

/*
 * Public接続用のNACLの作成
 */
function createNACL(parent: Construct, vpc: ec2.Vpc, props: VpcProps) {
  //  --------------------------------------------------------------
  // NACL for Public Subnets
  const naclPublic = new ec2.NetworkAcl(parent, 'NaclPublic', {
    vpc: vpc,
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
}

/*
 * プロパティの設定値に従って、VPC Endpointsを作成
 */
interface vpcEndpointDic {
  [name: string]: ec2.VpcEndpoint;
}
function createVpCEndpoints(vpc: ec2.Vpc, props: VpcProps): vpcEndpointDic {
  const results: vpcEndpointDic = {}; //戻り値

  if (props.vpcEndpoints == null) {
    return results;
  }

  //パラメータ設定に従って VPC Endpointsを作成する
  for (const type of props.vpcEndpoints) {
    if (type == VpcEndpointTypeName.S3_Gateway) {
      const endpoint = vpc.addGatewayEndpoint('S3GatewayEndpoint', {
        service: ec2.GatewayVpcEndpointAwsService.S3,
        subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
      });
      results[VpcEndpointTypeName.S3_Gateway] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'S3GatewayEndpoint'); //CFnがVPC Endpointsのタグ付けをサポートしていないため
    } else if (type == VpcEndpointTypeName.S3_Interface) {
      const endpoint = vpc.addInterfaceEndpoint('S3InterfaceEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.S3,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        privateDnsEnabled: false, //デフォルト trueなのでOFFにする。trueにする場合は S3_GATEWAY Endpointsを先に作成しておく必要がある
      });
      results[VpcEndpointTypeName.S3_Interface] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'S3InterfaceEndpoint');
    } else if (type == VpcEndpointTypeName.DynamoDB) {
      const endpoint = vpc.addGatewayEndpoint('DynamoDbEndpoint', {
        service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
      });
      results[VpcEndpointTypeName.DynamoDB] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'DynamoDbEndpoint');
    } else if (type == VpcEndpointTypeName.ECR) {
      const endpoint = vpc.addInterfaceEndpoint('EcrEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.ECR,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results[VpcEndpointTypeName.ECR] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'EcrEndpoint');
    } else if (type == VpcEndpointTypeName.ECR_Docker) {
      const endpoint = vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results[VpcEndpointTypeName.ECR_Docker] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'EcrDockerEndpoint');
    } else if (type == VpcEndpointTypeName.CWLogs) {
      const endpoint = vpc.addInterfaceEndpoint('LogsEndpointForPrivate', {
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results[VpcEndpointTypeName.CWLogs] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'LogsEndpointForPrivate');
    } else if (type == VpcEndpointTypeName.SecretsManager) {
      const endpoint = vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results[VpcEndpointTypeName.SecretsManager] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'SecretsManagerEndpoint');
    } else if (type == VpcEndpointTypeName.SSM) {
      //SSM接続に必要な4つのVPC Endpointを作成
      let endpoint = vpc.addInterfaceEndpoint('SSMEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results['SSM'] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'SSMEndpoint');

      endpoint = vpc.addInterfaceEndpoint('SSMMessagesEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results['SSMMessages'] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'SSMMessagesEndpoint');

      endpoint = vpc.addInterfaceEndpoint('EC2Endpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.EC2,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results['EC2'] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'EC2Endpoint');

      endpoint = vpc.addInterfaceEndpoint('EC2MessagesEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results['EC2Messages'] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'Ec2MessagesEndpoint');
    } else if (type == VpcEndpointTypeName.Glue) {
      const endpoint = vpc.addInterfaceEndpoint('GlueEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.GLUE,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results[VpcEndpointTypeName.Glue] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'GlueEndpoint');
    } else if (type == VpcEndpointTypeName.KMS) {
      const endpoint = vpc.addInterfaceEndpoint('KMSEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.KMS,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
      results[VpcEndpointTypeName.KMS] = endpoint;
      //cdk.Tags.of(endpoint).add('Name', 'KMSEndpoint');
    } else {
      console.error('VPC Endpoint name:' + type + ' is not supported.');
    }
  }
  return results;
}
