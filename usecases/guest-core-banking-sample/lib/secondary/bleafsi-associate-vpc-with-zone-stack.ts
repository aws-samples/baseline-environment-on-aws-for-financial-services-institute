import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { custom_resources as cr } from 'aws-cdk-lib';
import { RegionEnv } from '../shared/bleafsi-types';
import { CrossRegionSsmParamName } from '../shared/bleafsi-constants';
import { CrossRegionSsmParam } from '../shared/bleafsi-cross-region-ssm-param-stack';

interface AssociateVpcWithZoneStackProps extends cdk.NestedStackProps {
  myVpc: ec2.Vpc;
  primary: RegionEnv;
  envName: string;
}

export class AssociateVpcWithZoneStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: AssociateVpcWithZoneStackProps) {
    super(scope, id, props);

    const { myVpc, primary, envName } = props;

    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    const privateHostedZoneId = crossRegionSsmParam.get(CrossRegionSsmParamName.PRIVATE_HOSTED_ZONE_ID);

    const crStackId = 'Route53AssociateVpc';
    new cr.AwsCustomResource(this, crStackId, {
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
        physicalResourceId: cr.PhysicalResourceId.of(crStackId),
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
