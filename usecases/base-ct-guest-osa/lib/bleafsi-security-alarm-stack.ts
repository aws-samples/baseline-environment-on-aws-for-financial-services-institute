import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_events as cwe } from 'aws-cdk-lib';
import { aws_events_targets as cwet } from 'aws-cdk-lib';

/*
 * SNS Topicによるアラームメール通知の設定
 */

interface SecurityAlarmStackProps extends cdk.StackProps {
  notifyEmail: string;
}

export class SecurityAlarmStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: SecurityAlarmStackProps) {
    super(scope, id, props);

    // SNS Topic for Security Alarm
    const secTopic = new sns.Topic(this, 'SecurityAlarmTopic');
    new sns.Subscription(this, 'SecurityAlarmEmail', {
      endpoint: props.notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: secTopic,
    });
    this.alarmTopic = secTopic;

    // Allow to publish message from CloudWatch
    secTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['SNS:Publish'],
        resources: [secTopic.topicArn],
      }),
    );

    // Allow to publish through ssl
    secTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowPublishThroughSSLOnly',
        actions: ['SNS:Publish'],
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        resources: [secTopic.topicArn],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
      }),
    );

    // --------------- ConfigRule Compliance Change Notification -----------------
    // ConfigRule - Compliance Change
    //  See: https://docs.aws.amazon.com/config/latest/developerguide/monitor-config-with-cloudwatchevents.html
    //  See: https://aws.amazon.com/premiumsupport/knowledge-center/config-resource-non-compliant/?nc1=h_ls
    //  通知するルールを追加したい場合は、'configRuleName'配列にルール名を追加して下さい
    //  Sample Rule 'bb-default-security-group-closed' は base-ct-guest/lib/bleafsi-config-rules-stack.ts を参照
    new cwe.Rule(this, 'BLEAFSIRuleConfigRules', {
      description: 'EventBridge Event Rule to send notification on Config Rule compliance changes.',
      enabled: true,
      eventPattern: {
        source: ['aws.config'],
        detailType: ['Config Rules Compliance Change'],
        detail: {
          configRuleName: ['bb-default-security-group-closed'],
          newEvaluationResult: {
            complianceType: ['NON_COMPLIANT'],
          },
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // ------------------------ AWS Health Notification ---------------------------

    // AWS Health - Notify any events on AWS Health
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/cloudwatch-notification-scheduled-events/?nc1=h_ls
    new cwe.Rule(this, 'BLEFSIARuleAwsHealth', {
      description: 'Notify AWS Health event',
      enabled: true,
      eventPattern: {
        source: ['aws.health'],
        detailType: ['AWS Health Event'],
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // ------------ Detective guardrails from NIST standard template ----------------
    // See: https://aws.amazon.com/blogs/publicsector/automating-compliance-architecting-for-fedramp-high-and-nist-workloads-in-aws-govcloud-us/

    // Security Groups Change Notification
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/monitor-security-group-changes-ec2/?nc1=h_ls
    //  from NIST template
    new cwe.Rule(this, 'BLEAFSIRuleSecurityGroupChange', {
      description: 'Notify to create, update or delete a Security Group.',
      enabled: true,
      eventPattern: {
        source: ['aws.ec2'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['ec2.amazonaws.com'],
          eventName: [
            'AuthorizeSecurityGroupIngress',
            'AuthorizeSecurityGroupEgress',
            'RevokeSecurityGroupIngress',
            'RevokeSecurityGroupEgress',
          ],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // Network ACL Change Notification
    //  from NIST template
    new cwe.Rule(this, 'BLEAFSIRuleNetworkAclChange', {
      description: 'Notify to create, update or delete a Network ACL.',
      enabled: true,
      eventPattern: {
        source: ['aws.ec2'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['ec2.amazonaws.com'],
          eventName: [
            'CreateNetworkAcl',
            'CreateNetworkAclEntry',
            'DeleteNetworkAcl',
            'DeleteNetworkAclEntry',
            'ReplaceNetworkAclEntry',
            'ReplaceNetworkAclAssociation',
          ],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // CloudTrail Change
    //  from NIST template
    /*new cwe.Rule(this, 'BLEAFSIRuleCloudTrailChange', {
      description: 'Notify to change on CloudTrail log configuration',
      enabled: true,
      eventPattern: {
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['cloudtrail.amazonaws.com'],
          eventName: ['StopLogging', 'DeleteTrail', 'UpdateTrail'],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });*/
    //CloudTrailマルチリージョン証跡により、大阪リージョンではなく東京リージョンでCloudTrail証跡が取られるため、CloudTrail自体のイベントによるアラート、
    //CW Logsのアラートは大阪リージョンでは実装しない

    // ------------------- Other security services integration ----------------------

    // SecurityHub - Imported
    //   Security Hub automatically sends all new findings and all updates to existing findings to EventBridge as Security Hub Findings - Imported events.
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cwe-integration-types.html
    //
    //   Security Hub Finding format
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-findings-format.html
    new cwe.Rule(this, 'BLEAFSIRuleSecurityHub', {
      description: 'EventBridge Event Rule to send notification on SecurityHub all new findings and all updates.',
      enabled: true,
      eventPattern: {
        source: ['aws.securityhub'],
        detailType: ['Security Hub Findings - Imported'],
        detail: {
          findings: {
            Severity: {
              Label: ['CRITICAL', 'HIGH'],
            },
            Compliance: {
              Status: ['FAILED'],
            },
            Workflow: {
              Status: ['NEW', 'NOTIFIED'],
            },
            RecordState: ['ACTIVE'],
          },
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // GuardDutyFindings
    //   Will alert for any Medium to High finding.
    //   See: https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_findings_cloudwatch.html
    new cwe.Rule(this, 'BLEAFSIRuleGuardDuty', {
      description: 'EventBridge Event Rule to send notification on GuardDuty findings.',
      enabled: true,
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding'],
        detail: {
          severity: [
            4, 4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5, 5.0, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6,
            6.0, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7, 7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8,
            8.0, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9,
          ],
        },
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });
  }
}
