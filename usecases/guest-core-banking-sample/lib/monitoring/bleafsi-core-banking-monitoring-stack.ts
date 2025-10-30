import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from '../shared/vpc';
import { CrossRegionSsmParamName } from '../shared/constants';
import { AssociateVpcWithZone } from '../shared/associate-vpc-with-zone';
import { StackParameter } from '../../bin/parameter';
import { Canary } from '../shared/sample-multi-region-app/canary';
import { CloudWatchAlarm } from '../shared/sample-multi-region-app/cloud-watch-alarm';

interface CoreBankingMonitoringStackProps extends StackParameter {
  primaryTgwRouteTableId: string;
  secondaryTgwRouteTableId: string;
}
/*
 * BLEA-FSI Core Banking Sample application stack (Monitoring region)
 */
export class CoreBankingMonitoringStack extends cdk.Stack {
  public readonly primaryTgwPeeringAttachmentId: string;
  public readonly secondaryTgwPeeringAttachmentId: string;
  public readonly alarmName: string;
  readonly tgwRouteTableId: string;

  constructor(scope: Construct, id: string, props: CoreBankingMonitoringStackProps) {
    super(scope, id, props);

    const { primary, secondary, monitoring, envName, hostedZoneName } = props;

    // Networking
    const monitoringVpc = new Vpc(this, `Vpc`, {
      regionEnv: monitoring,
      oppositeRegionCidrs: [primary.vpcCidr, secondary.vpcCidr],
    });

    this.primaryTgwPeeringAttachmentId = monitoringVpc.createTgwPeeringAttachment(
      CrossRegionSsmParamName.TGW_PRIMARY_ID,
      primary.region,
      envName,
      primary.region,
    );
    this.secondaryTgwPeeringAttachmentId = monitoringVpc.createTgwPeeringAttachment(
      CrossRegionSsmParamName.TGW_SECONDARY_ID,
      secondary.region,
      envName,
      secondary.region,
    );

    // Route 53 Private Hosted Zone
    const associateVpcWithHostedZone = new AssociateVpcWithZone(this, `AssociateVpcWithHostedZone`, {
      myVpc: monitoringVpc.myVpc,
      primary,
      envName,
      zoneName: hostedZoneName,
    });
    associateVpcWithHostedZone.node.addDependency(monitoringVpc);

    this.tgwRouteTableId = monitoringVpc.getTgwRouteTableId(this);

    // CloudWatch synthetics
    const canary = new Canary(this, 'Canary', {
      vpc: monitoringVpc.myVpc,
      targetApiUrl: `http://api.${hostedZoneName}`,
    });

    const cloudWatchAlarm = new CloudWatchAlarm(this, 'CloudWatchAlarm', {
      alarmName: `canaryAlerm-${monitoring.region}`,
      canaryName: canary.canaryName,
    });
    this.alarmName = cloudWatchAlarm.alarmName;

    //CFn output
    new cdk.CfnOutput(this, 'CLI for TGW peering acceptance to primary region ', {
      value:
        `aws ec2 accept-transit-gateway-peering-attachment --region ${props.primary.region} ` +
        `--transit-gateway-attachment-id ${this.primaryTgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '1. Subsequent CLI for TGW peering acceptance to primary region',
    });

    new cdk.CfnOutput(this, 'CLI for adding TGW route in primary region ', {
      value:
        `aws ec2 create-transit-gateway-route --region ${props.primary.region} --destination-cidr-block ${props.monitoring.regionCidr} ` +
        `--transit-gateway-route-table-id ${props.primaryTgwRouteTableId} --transit-gateway-attachment-id ${this.primaryTgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '2. Subsequent CLI for adding TGW route in primary region',
    });

    new cdk.CfnOutput(this, 'CLI for adding TGW route to primary region in monitoring region ', {
      value:
        `aws ec2 create-transit-gateway-route --region ${props.monitoring.region} --destination-cidr-block ${props.primary.regionCidr} ` +
        `--transit-gateway-route-table-id ${this.tgwRouteTableId} --transit-gateway-attachment-id ${this.primaryTgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '3. Subsequent CLI for adding TGW route to primary region in monitoring region',
    });

    new cdk.CfnOutput(this, 'CLI for TGW peering acceptance to secondary region ', {
      value:
        `aws ec2 accept-transit-gateway-peering-attachment --region ${props.secondary.region} ` +
        `--transit-gateway-attachment-id ${this.secondaryTgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '4. Subsequent CLI for TGW peering acceptance to secondary region',
    });

    new cdk.CfnOutput(this, 'CLI for adding TGW route in secondary region ', {
      value:
        `aws ec2 create-transit-gateway-route --region ${props.secondary.region} --destination-cidr-block ${props.monitoring.regionCidr} ` +
        `--transit-gateway-route-table-id ${props.secondaryTgwRouteTableId} --transit-gateway-attachment-id ${this.secondaryTgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '5. Subsequent CLI for adding TGW route in secondary region',
    });

    new cdk.CfnOutput(this, 'CLI for adding TGW route to secondary region in monitoring region ', {
      value:
        `aws ec2 create-transit-gateway-route --region ${props.monitoring.region} --destination-cidr-block ${props.secondary.regionCidr} ` +
        `--transit-gateway-route-table-id ${this.tgwRouteTableId} --transit-gateway-attachment-id ${this.secondaryTgwPeeringAttachmentId} --profile ct-guest-sso`,
      description: '6. Subsequent CLI for adding TGW route to secondary region in monitoring region',
    });
  }
}
