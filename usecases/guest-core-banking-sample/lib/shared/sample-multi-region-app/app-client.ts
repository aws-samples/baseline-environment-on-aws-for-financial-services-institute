import { Construct } from 'constructs';
import { ClientVpc } from './app-client-vpc';
import { BastionHostLinux, BlockDeviceVolume, CfnTransitGateway, EbsDeviceVolumeType, IVpc } from 'aws-cdk-lib/aws-ec2';
import { PrivateHostedZone } from 'aws-cdk-lib/aws-route53';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';

export interface SampleAppClientProps {
  vpcCidr: string;
  transitGateway: CfnTransitGateway;
  parentVpc: IVpc;
  secondaryVpcCidr: string;
  hostedZone: PrivateHostedZone;
}

/**
 * サンプルアプリケーションに接続するクライアントが稼働するEC2インスタンスを作成
 */
export class SampleAppClient extends Construct {
  constructor(scope: Construct, id: string, props: SampleAppClientProps) {
    super(scope, id);

    const vpc = new ClientVpc(this, 'Vpc', {
      tgwAsn: 64514,
      vpcCidr: props.vpcCidr,
      parentVpc: props.parentVpc,
      transitGateway: props.transitGateway,
      secondaryVpcCidr: props.secondaryVpcCidr,
    });

    props.hostedZone.addVpc(vpc.vpc);

    const bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const deployment = new BucketDeployment(this, 'Deploy', {
      destinationBucket: bucket,
      destinationKeyPrefix: 'client',
      sources: [Source.asset('sample-multi-region-app/client')],
    });

    const client = new BastionHostLinux(this, 'Instance', {
      vpc: vpc.vpc,
      subnetSelection: { subnets: vpc.vpc.publicSubnets },
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: BlockDeviceVolume.ebs(20, {
            volumeType: EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    bucket.grantRead(client);
    client.instance.node.addDependency(deployment);

    client.instance.addUserData(
      // 'install docker'
      'yum install -y docker',
      'systemctl enable docker',
      'systemctl start docker',
      'usermod -aG docker ec2-user',
      'chmod 777 /var/run/docker.sock',
      // install tools for debug
      'yum install -y tmux htop',
      // create a sh file with aws cli
      `echo '#!/bin/bash' > /home/ec2-user/pull.sh`,
      `echo 'aws s3 sync ${bucket.s3UrlForObject('client')} /home/ec2-user/client' >> /home/ec2-user/pull.sh`,
      'chown ec2-user /home/ec2-user/pull.sh',
      `chmod +x /home/ec2-user/pull.sh`,
    );
  }
}
