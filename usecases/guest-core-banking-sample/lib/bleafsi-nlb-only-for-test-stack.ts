import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as elbv2 } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2_targets as elbv2_targets } from 'aws-cdk-lib';

interface NlbOnlyForTestContextProps extends cdk.StackProps {
  pjPrefix: string;
  myVpc: ec2.Vpc;
  targetAlb: elbv2.ApplicationLoadBalancer;
}

export class NlbOnlyForTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NlbOnlyForTestContextProps) {
    super(scope, id, props);

    const { pjPrefix, myVpc, targetAlb } = props;

    // Network Load Balancer for test
    const lb = new elbv2.NetworkLoadBalancer(this, `${pjPrefix}-NlbOnlyForTest`, {
      vpc: myVpc,
      internetFacing: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });
    const listener = lb.addListener(`${pjPrefix}-TestNlbListener`, {
      port: 80,
    });
    listener.addTargets(`${pjPrefix}-TargetAlb`, {
      port: 80,
      targets: [new elbv2_targets.AlbArnTarget(targetAlb.loadBalancerArn, 80)],
    });

    // You can access this URL over the Internet.
    new cdk.CfnOutput(this, 'TestNlbUrl', {
      value: `http://${lb.loadBalancerDnsName}`,
    });
  }
}
