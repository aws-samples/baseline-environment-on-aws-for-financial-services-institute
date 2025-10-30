import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

/**
 * CloudFront に設定する WAF Web ACL を作成するスタック
 */
export class CloudFrontWafStack extends cdk.Stack {
  /**
   * Web ACL ARN
   */
  public readonly webAclArn: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * CloudFront を保護する WAF Web ACL に設定する IP アドレスを取得
     */
    const wafIpv4AllowAddresses: string[] = this.node.tryGetContext('wafIpv4AllowAddresses') ?? [
      '0.0.0.0/1',
      '128.0.0.0/1',
    ];
    const wafIpv6AllowAddresses: string[] = this.node.tryGetContext('wafIpv6AllowAddresses') ?? ['::/1', '8000::/1'];

    /**
     * WAF に許可する IP アドレスのリストを設定
     */
    const ipV4SetReferenceStatement = new wafv2.CfnIPSet(this, 'CloudFrontIpV4Set', {
      ipAddressVersion: 'IPV4',
      scope: 'CLOUDFRONT',
      addresses: wafIpv4AllowAddresses,
    });
    const ipV6SetReferenceStatement = new wafv2.CfnIPSet(this, 'CloudFrontIpV6Set', {
      ipAddressVersion: 'IPV6',
      scope: 'CLOUDFRONT',
      addresses: wafIpv6AllowAddresses,
    });

    /**
     * ウェブリクエストを IP アドレスでフィルタリングするルールを作成
     */
    const webAcl = new wafv2.CfnWebACL(this, 'CloudFrontWebAcl', {
      defaultAction: { block: {} },
      name: 'CloudFrontWebAcl',
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'CloudFrontWebAcl',
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          priority: 0,
          name: 'CloudFrontWebAclIpV4RuleSet',
          action: { allow: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CloudFrontWebAcl',
            sampledRequestsEnabled: true,
          },
          statement: {
            ipSetReferenceStatement: { arn: ipV4SetReferenceStatement.attrArn },
          },
        },
        {
          priority: 1,
          name: 'CloudFrontWebAclIpV6RuleSet',
          action: { allow: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CloudFrontWebAcl',
            sampledRequestsEnabled: true,
          },
          statement: {
            ipSetReferenceStatement: { arn: ipV6SetReferenceStatement.attrArn },
          },
        },
      ],
    });

    this.webAclArn = new cdk.CfnOutput(this, 'CloudFrontWebAclId', {
      value: webAcl.attrArn,
    });
  }
}
