import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2_targets as elbv2_targets } from 'aws-cdk-lib';

/*
 * テスト用に利用するNetwork Load Balancerの作成
 */

export interface NlbOnlyForTestProps {
  myVpc: ec2.Vpc;
  targetAlb: elbv2.ApplicationLoadBalancer;
}

export class NlbOnlyForTest extends Construct {
  constructor(scope: Construct, id: string, props: NlbOnlyForTestProps) {
    super(scope, id);

    const { myVpc, targetAlb } = props;

    // Network Load Balancer for test
    const lb = new elbv2.NetworkLoadBalancer(this, `NlbOnlyForTest`, {
      vpc: myVpc,
      internetFacing: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });
    const listener = lb.addListener(`TestNlbListener`, {
      port: 80,
    });
    listener.addTargets(`TargetAlb`, {
      port: 80,
      targets: [new elbv2_targets.AlbArnTarget(targetAlb.loadBalancerArn, 80)],
    });

    // You can access this URL over the Internet.
    new cdk.CfnOutput(this, 'TestNlbUrl', {
      value: `http://${lb.loadBalancerDnsName}`,
    });
  }
}
