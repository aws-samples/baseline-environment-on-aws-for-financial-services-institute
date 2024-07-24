import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackParameter } from '../../../bin/parameter';
import { aws_route53recoverycontrol as route53recoverycontrol } from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { IApplicationLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

interface CoreBankingArcStackProps extends StackParameter {
  hostedZone: IHostedZone;
  primaryAlb: IApplicationLoadBalancer;
  secondaryAlb: IApplicationLoadBalancer;
}

/**
 * BLEA-FSI Core Banking Sample application stack(Resources for Route53 ARC)
 */
export class CoreBankingArcStack extends cdk.Stack {
  /**
   * Comma separated string for cluster endpoints
   * @example https://asdfg.route53-recovery-cluster.ap-northeast-1.amazonaws.com/v1,https://qwerty.route53-recovery-cluster.ap-southeast-2.amazonaws.com/v1
   */
  public readonly clusterEndpoints: string;

  /**
   * Comma separated string for the regions of the cluster endpoints
   * @example ap-northeast-1,ap-southeast-2
   */
  public readonly clusterEndpointRegions: string;

  public readonly primaryRoutingControlArn: string;
  public readonly secondaryRoutingControlArn: string;

  constructor(scope: Construct, id: string, props: CoreBankingArcStackProps) {
    super(scope, id, props);

    const cfnCluster = new route53recoverycontrol.CfnCluster(this, 'Cluster', {
      name: 'ARC-CoreBanking',
    });

    const cfnControlPanel = new route53recoverycontrol.CfnControlPanel(this, 'ControlPanel', {
      name: 'CoreBanking-ControlPanel',
      clusterArn: cfnCluster.ref,
    });

    const cfnRoutingControlPrimary = new route53recoverycontrol.CfnRoutingControl(this, 'RoutingControlPrimary', {
      name: 'rc-tokyo',
      clusterArn: cfnCluster.ref,
      controlPanelArn: cfnControlPanel.ref,
    });
    this.primaryRoutingControlArn = cfnRoutingControlPrimary.attrRoutingControlArn;

    const cfnRoutingControlSecondary = new route53recoverycontrol.CfnRoutingControl(this, 'RoutingControlSecondary', {
      name: 'rc-osaka',
      clusterArn: cfnCluster.ref,
      controlPanelArn: cfnControlPanel.ref,
    });
    this.secondaryRoutingControlArn = cfnRoutingControlSecondary.attrRoutingControlArn;

    const cfnHealthCheckPrimary = new route53.CfnHealthCheck(this, 'HealthCheckPrimary', {
      healthCheckConfig: {
        routingControlArn: cfnRoutingControlPrimary.ref,
        type: 'RECOVERY_CONTROL',
      },
      healthCheckTags: [
        {
          key: 'Name',
          value: 'hc-tokyo',
        },
      ],
    });

    const cfnHealthCheckSecondary = new route53.CfnHealthCheck(this, 'HealthCheckSecondary', {
      healthCheckConfig: {
        routingControlArn: cfnRoutingControlSecondary.ref,
        type: 'RECOVERY_CONTROL',
      },
      healthCheckTags: [
        {
          key: 'Name',
          value: 'hc-osaka',
        },
      ],
    });

    new route53.CfnRecordSet(this, 'RecordSetPrimary', {
      name: `api.${props.hostedZone.zoneName}`,
      type: 'A',
      aliasTarget: {
        dnsName: props.primaryAlb.loadBalancerDnsName,
        hostedZoneId: props.primaryAlb.loadBalancerCanonicalHostedZoneId,
      },
      failover: 'PRIMARY',
      healthCheckId: cfnHealthCheckPrimary.ref,
      hostedZoneId: props.hostedZone.hostedZoneId,
      setIdentifier: 'tokyo',
    });

    new route53.CfnRecordSet(this, 'RecordSetSecondary', {
      name: `api.${props.hostedZone.zoneName}`,
      type: 'A',
      aliasTarget: {
        dnsName: props.secondaryAlb.loadBalancerDnsName,
        hostedZoneId: props.secondaryAlb.loadBalancerCanonicalHostedZoneId,
      },
      failover: 'SECONDARY',
      healthCheckId: cfnHealthCheckSecondary.ref,
      hostedZoneId: props.hostedZone.hostedZoneId,
      setIdentifier: 'osaka',
    });

    // We use a custom resource to get cluster endpoints because CfnCluster's return value is not accessible.
    // https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/2029
    const handler = new Function(this, 'DescribeClusterHandler', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      code: Code.fromInline(`
const response = require('cfn-response');
const sdk = require('@aws-sdk/client-route53-recovery-control-config');
// Route53RecoveryControlConfig API is only available on us-west-2
const client = new sdk.Route53RecoveryControlConfigClient({region: 'us-west-2'});

exports.handler = async function(event, context) {
  try {
    console.log(event);
    if (event.RequestType == 'Delete') {
      return await response.send(event, context, response.SUCCESS);
    }
    const clusterArn = event.ResourceProperties.ClusterArn;
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/route53-recovery-control-config/command/DescribeClusterCommand/
    const command = new sdk.DescribeClusterCommand({ClusterArn: clusterArn});
    const res = await client.send(command);
    const clusterEndpoints = res.Cluster.ClusterEndpoints;
    const endpoints = clusterEndpoints.map(c=>c.Endpoint).join(',');
    const regions = clusterEndpoints.map(c=>c.Region).join(',');
    await response.send(event, context, response.SUCCESS, {endpoints, regions}, clusterArn);
  } catch (e) {
    console.log(e);
    await response.send(event, context, response.FAILED);
  }
};
`),
    });
    handler.addToRolePolicy(
      new PolicyStatement({
        actions: ['route53-recovery-control-config:DescribeCluster'],
        resources: [cfnCluster.attrClusterArn],
      }),
    );

    const describeClusterResult = new cdk.CustomResource(this, 'DescribeClusterResult', {
      serviceToken: handler.functionArn,
      resourceType: 'Custom::DescribeClusterResult',
      properties: { ClusterArn: cfnCluster.attrClusterArn },
    });

    this.clusterEndpoints = describeClusterResult.getAttString('endpoints');
    this.clusterEndpointRegions = describeClusterResult.getAttString('regions');
  }
}
