import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Waf } from '../lib/bleafsi-waf';
/*
 * このサブプロジェクトのlib配下に作成した WAF Construct をテストするためのStack
 */

export class WafStack extends cdk.Stack {
  readonly wafs: Waf[];
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.wafs = [];

    const waf1 = new Waf(this, 'WafStack1');
    this.wafs.push(waf1);

    const waf2 = new Waf(this, 'WafStack2', {
      name: 'WebACL2',
      description: 'created by waf-stack',
      rules: [
        Waf.getManagedRuleSet(1, 'AWS', 'AWSManagedRulesCommonRuleSet'),
        Waf.getManagedRuleSet(2, 'AWS', 'AWSManagedRulesWindowsRuleSet'),
      ],
    });

    //CFn output
    new cdk.CfnOutput(this, 'WAF Web ACL1', {
      value: waf1.webAcl.attrArn,
    });
    new cdk.CfnOutput(this, 'WAF Web ACL2', {
      value: waf2.webAcl.attrArn,
    });
  }
}
