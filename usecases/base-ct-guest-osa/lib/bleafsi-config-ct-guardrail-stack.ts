import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { cloudformation_include as cfn_inc } from 'aws-cdk-lib';
import { aws_config as config } from 'aws-cdk-lib';

/*
 * Control Tower ガードレール相当のConfig Rulesを設定する
 */
export class ConfigCtGuardrailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // https://github.com/awslabs/aws-config-rules/tree/master/aws-config-conformance-packs
    new cfn_inc.CfnInclude(this, 'ConfigCtGr', {
      templateFile: 'cfn/AWS-Control-Tower-Detective-Guardrails.yaml',
    });

    // デフォルトセキュリティグループが閉じている（inbound/outboundを許可していない）ことをチェックするConfigRuleを作成
    // ConfigRule for Default Security Group is closed
    //
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-4.3
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html
    new config.ManagedRule(this, 'BLEAFSIRuleDefaultSecurityGroupClosed', {
      identifier: config.ManagedRuleIdentifiers.VPC_DEFAULT_SECURITY_GROUP_CLOSED,
      ruleScope: config.RuleScope.fromResources([config.ResourceType.EC2_SECURITY_GROUP]),
      configRuleName: 'bb-default-security-group-closed',
      description:
        'Checks that the default security group of any Amazon Virtual Private Cloud (VPC) does not allow inbound or outbound traffic. The rule is non-compliant if the default security group has one or more inbound or outbound traffic.',
    });
  }
}
