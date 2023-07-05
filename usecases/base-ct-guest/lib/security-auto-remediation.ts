import { Construct } from 'constructs';
import { aws_config as config } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/*
 * デフォルトセキュリティグループが閉じている（inbound/outboundを許可していない）ことをチェックするConfigRuleを作成
 * 違反している場合は、SSMにより自動的に修正が行われる
 */
export class SecurityAutoRemediation extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // ConfigRule for Default Security Group is closed  (Same as SecurityHub - need this for auto remediation)
    //
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-cis-controls-4.3
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html
    const ruleDefaultSgClosed = new config.ManagedRule(this, 'ConfigRule', {
      identifier: config.ManagedRuleIdentifiers.VPC_DEFAULT_SECURITY_GROUP_CLOSED,
      ruleScope: config.RuleScope.fromResources([config.ResourceType.EC2_SECURITY_GROUP]),
      configRuleName: 'bb-default-security-group-closed',
      description:
        'Checks that the default security group of any Amazon Virtual Private Cloud (VPC) does not allow inbound or outbound traffic. The rule is non-compliant if the default security group has one or more inbound or outbound traffic.',
    });

    // Create an Auto remediation
    new AutoRemediation(this, 'AutoRemediation', ruleDefaultSgClosed);
  }
}

/////////// private Construct /////////////////
class AutoRemediation extends Construct {
  constructor(scope: Construct, id: string, ruleDefaultSgClosed: config.ManagedRule) {
    super(scope, id);
    //1. Role の作成
    const rmDefaultSgRole = new iam.Role(this, 'IamRole', {
      assumedBy: new iam.ServicePrincipal('ssm.amazonaws.com'),
      path: '/',
      managedPolicies: [{ managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AmazonSSMAutomationRole' }],
    });

    rmDefaultSgRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ec2:RevokeSecurityGroupIngress', 'ec2:RevokeSecurityGroupEgress', 'ec2:DescribeSecurityGroups'],
        resources: ['*'],
      }),
    );
    rmDefaultSgRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [rmDefaultSgRole.roleArn],
      }),
    );
    rmDefaultSgRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:StartAutomationExecution'],
        resources: ['arn:aws:ssm:::automation-definition/AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules'],
      }),
    );

    // 2. SSMを使った自動修復のための ConfigRule Remediation
    // Remediation for Remove VPC Default SecurityGroup Rules  by  SSM Automation
    new config.CfnRemediationConfiguration(this, 'Default', {
      configRuleName: ruleDefaultSgClosed.configRuleName,
      targetType: 'SSM_DOCUMENT',
      targetId: 'AWSConfigRemediation-RemoveVPCDefaultSecurityGroupRules',
      targetVersion: '1',
      parameters: {
        AutomationAssumeRole: {
          StaticValue: {
            Values: [rmDefaultSgRole.roleArn],
          },
        },
        GroupId: {
          ResourceValue: {
            Value: 'RESOURCE_ID',
          },
        },
      },
      automatic: true,
      maximumAutomaticAttempts: 5,
      retryAttemptSeconds: 60,
    });
  }
}
