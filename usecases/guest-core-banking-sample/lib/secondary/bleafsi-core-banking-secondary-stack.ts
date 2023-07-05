import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from '../shared/vpc';
import { DbAuroraPgGlobalMember } from './db-aurora-pg-global-member';
import { Waf } from '../shared/waf';
import { KeyApp } from '../shared/key-app';
import { MonitorAlarm } from '../shared/monitor-alarm';
import { SecondaryContainerAppSample } from './secondary-container-app-sample';
import { CrossRegionSsmParamName } from '../shared/constants';
import { AssociateVpcWithZone } from './associate-vpc-with-zone';
import { StackParameter, SampleEcsAppParameter, SampleMultiRegionAppParameter } from '../../bin/parameter';
//マルチリージョン 勘定系サンプルアプリ
import { SampleMultiRegionApp } from '../shared/sample-multi-region-app/app';

interface CoreBankingSecondaryStackProps extends StackParameter {
  auroraSecretName: string;
  dynamoDbTableName: string;
  tgwRouteTableId: string;
}

/*
 * BLEA-FSI Core Banking Sample application stack(Secondary region)
 */

export class CoreBankingSecondaryStack extends cdk.Stack {
  public readonly secondaryDB: DbAuroraPgGlobalMember;
  public readonly tgwPeeringAttachmentId: string;

  constructor(scope: Construct, id: string, props: CoreBankingSecondaryStackProps) {
    super(scope, id, props);

    const { notifyEmail, primary, secondary, envName, hostedZoneName } = props;

    // Topic for monitoring guest system
    const monitorSecondaryAlarm = new MonitorAlarm(this, `MonitorAlarm`, { notifyEmail });

    // CMK for Primary Apps
    const secondaryAppKey = new KeyApp(this, `AppKey`);

    // Networking
    const secondaryVpc = new Vpc(this, `Vpc`, {
      regionEnv: secondary,
      oppositeRegionCidrs: [primary.vpcCidr, SampleMultiRegionAppParameter.appClientVpcCidr],
    });

    this.tgwPeeringAttachmentId = secondaryVpc.createTgwPeeringAttachment(
      CrossRegionSsmParamName.TGW_PRIMARY_ID,
      primary.region,
      envName,
      primary.region,
    );

    // Route 53 Private Hosted Zone
    const associateVpcWithHostedZone = new AssociateVpcWithZone(this, `AssociateVpcWithHostedZone`, {
      myVpc: secondaryVpc.myVpc,
      primary,
      envName,
      zoneName: hostedZoneName,
    });
    associateVpcWithHostedZone.node.addDependency(secondaryVpc);

    // WebACL for ALB
    const waf = new Waf(this, `Waf`, {
      scope: 'REGIONAL',
    });

    //ECSサンプルアプリのデプロイ
    let ecsApp;
    if (SampleEcsAppParameter.deploy == true) {
      // Sample Application Stack (LoadBalancer + Fargate)
      ecsApp = new SecondaryContainerAppSample(this, `ECSApp`, {
        envName,
        myVpc: secondaryVpc.myVpc,
        webAcl: waf.webAcl,
        appKey: secondaryAppKey.kmsKey,
        primary,
      });
    }

    // Aurora Global DB
    this.secondaryDB = new DbAuroraPgGlobalMember(this, `DBAuroraPg`, {
      myVpc: secondaryVpc.myVpc,
      secretName: props.auroraSecretName,
      vpcSubnets: secondaryVpc.myVpc.selectSubnets({
        subnetGroupName: 'Protected',
      }),
      appServerSecurityGroup: ecsApp?.appServerSecurityGroup,
      appKey: secondaryAppKey.kmsKey,
      alarmTopic: monitorSecondaryAlarm.alarmTopic,
    });

    //マルチリージョン 勘定系サンプルアプリのデプロイ
    if (SampleMultiRegionAppParameter.deploy == true) {
      new SampleMultiRegionApp(this, 'SampleMultiRegionApp', {
        mainDynamoDbTableName: props.dynamoDbTableName,
        balanceDatabase: this.secondaryDB,
        countDatabase: this.secondaryDB,
        vpc: secondaryVpc.myVpc,
        hostedZone: associateVpcWithHostedZone.hostedZone,
      });
    }

    //CFn output
    const output1 = new cdk.CfnOutput(this, 'CLI for TGW peering acceptance ', {
      value:
        `aws ec2 accept-transit-gateway-peering-attachment --region ${props.primary.region} ` +
        `--transit-gateway-attachment-id ${this.tgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '1. Subsequent CLI for TGW peering acceptance',
    });

    const output2 = new cdk.CfnOutput(this, 'CLI for adding TGW route in primary region ', {
      value:
        `aws ec2 create-transit-gateway-route --region ${props.primary.region} --destination-cidr-block ${props.secondary.regionCidr} ` +
        `--transit-gateway-route-table-id ${props.tgwRouteTableId} --transit-gateway-attachment-id ${this.tgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '2. Subsequent CLI for adding TGW route in primary region',
    });

    const output3 = new cdk.CfnOutput(this, 'CLI for adding TGW route in secondary region ', {
      value:
        `aws ec2 create-transit-gateway-route --region ${props.secondary.region} --destination-cidr-block ${props.primary.regionCidr} ` +
        `--transit-gateway-route-table-id ${secondaryVpc.getTgwRouteTableId(this)} --transit-gateway-attachment-id ${
          this.tgwPeeringAttachmentId
        } --profile ct-guest-sso`,
      description: '3. Subsequent CLI for adding TGW route in secondary region',
    });
  }
}
