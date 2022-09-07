import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import { aws_route53_targets as route53_targets } from 'aws-cdk-lib';
import { RegionEnv } from '../shared/bleafsi-types';
import { CrossRegionSsmParamName } from '../shared/bleafsi-constants';
import { CrossRegionSsmParam } from '../shared/bleafsi-cross-region-ssm-param-stack';

interface PrivateHostedZoneStackProps extends cdk.NestedStackProps {
  myVpc: ec2.Vpc;
  alb: elbv2.ApplicationLoadBalancer;
  primary: RegionEnv;
  envName: string;
}

export class PrivateHostedZoneStack extends cdk.NestedStack {
  public readonly privateHostedZone: route53.PrivateHostedZone;

  constructor(scope: Construct, id: string, props: PrivateHostedZoneStackProps) {
    super(scope, id, props);

    const { myVpc, primary, envName, alb } = props;

    const zoneName = 'example.com';
    this.privateHostedZone = new route53.PrivateHostedZone(this, 'PrivateHostedZone', {
      zoneName,
      vpc: myVpc,
    });

    new route53.ARecord(this, 'AliasRecord', {
      zone: this.privateHostedZone,
      target: route53.RecordTarget.fromAlias(new route53_targets.LoadBalancerTarget(alb)),
    });

    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    crossRegionSsmParam.put(CrossRegionSsmParamName.PRIVATE_HOSTED_ZONE_ID, this.privateHostedZone.hostedZoneId);
  }
}
