import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import { aws_route53_targets as route53_targets } from 'aws-cdk-lib';
import { RegionEnv } from 'bin/parameter';
import { CrossRegionSsmParamName } from '../shared/constants';
import { CrossRegionSsmParam } from '../shared/cross-region-ssm-param';

/*
 * Route53のPrivate Hosted Zoneの作成
 */

interface PrivateHostedZoneProps {
  myVpc: ec2.Vpc;
  alb: elbv2.ApplicationLoadBalancer;
  primary: RegionEnv;
  envName: string;
  zoneName: string;
}

export class PrivateHostedZone extends Construct {
  public readonly privateHostedZone: route53.PrivateHostedZone;

  constructor(scope: Construct, id: string, props: PrivateHostedZoneProps) {
    super(scope, id);

    const { myVpc, primary, envName, alb, zoneName } = props;

    // private hosted zone
    this.privateHostedZone = new route53.PrivateHostedZone(this, 'Default', {
      zoneName,
      vpc: myVpc,
    });

    // alias record
    // ECSサンプルアプリケーションをデプロイしない場合は alb はnull
    if (alb != null) {
      new route53.ARecord(this, 'AliasRecord', {
        zone: this.privateHostedZone,
        target: route53.RecordTarget.fromAlias(new route53_targets.LoadBalancerTarget(alb)),
      });
    }

    // SSM Parameter to put Private Hosted Zone Id
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion: primary.region,
      envName,
    });
    crossRegionSsmParam.put(CrossRegionSsmParamName.PRIVATE_HOSTED_ZONE_ID, this.privateHostedZone.hostedZoneId);
  }
}
