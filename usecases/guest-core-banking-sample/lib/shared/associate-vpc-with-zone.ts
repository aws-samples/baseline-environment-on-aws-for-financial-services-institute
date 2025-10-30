import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { RegionEnv } from 'bin/parameter';
import { CrossRegionSsmParamName } from './constants';
import { CrossRegionSsmParam } from './cross-region-ssm-param';
import { IHostedZone, PrivateHostedZone } from 'aws-cdk-lib/aws-route53';

/*
 * Primary Regionに存在するPrivate Hosted ZoneをSecondary RegionのVPCに関連付ける
 */

interface AssociateVpcWithZoneProps {
  myVpc: ec2.Vpc;
  primary: RegionEnv;
  envName: string;
  zoneName: string;
}

export class AssociateVpcWithZone extends Construct {
  public readonly hostedZone: IHostedZone;

  constructor(scope: Construct, id: string, props: AssociateVpcWithZoneProps) {
    super(scope, id);

    const { myVpc, primary, envName, zoneName } = props;

    // SSM Parameter to get the Private Hosted Zone Id in the primary region
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    const privateHostedZoneId = crossRegionSsmParam.get(CrossRegionSsmParamName.PRIVATE_HOSTED_ZONE_ID);

    this.hostedZone = PrivateHostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      zoneName,
      hostedZoneId: privateHostedZoneId,
    });

    // Associate the VPC with the Privae Hosted Zone Id in the primary region
    const crConstructId = 'Route53AssociateVpc';
    new cr.AwsCustomResource(this, crConstructId, {
      onUpdate: {
        service: 'Route53',
        action: 'associateVPCWithHostedZone',
        parameters: {
          HostedZoneId: privateHostedZoneId,
          VPC: {
            VPCRegion: cdk.Stack.of(this).region,
            VPCId: myVpc.vpcId,
          },
        },
        region: primary.region,
        physicalResourceId: cr.PhysicalResourceId.of(crConstructId),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['route53:*', 'ec2:*'],
          resources: ['*'],
        }),
      ]),
    });
  }
}
