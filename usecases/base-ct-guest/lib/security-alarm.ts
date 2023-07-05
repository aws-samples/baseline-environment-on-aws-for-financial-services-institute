import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_cloudwatch as cw } from 'aws-cdk-lib';
import { aws_cloudwatch_actions as cwa } from 'aws-cdk-lib';
import { aws_events as cwe } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_events_targets as cwet } from 'aws-cdk-lib';

/*
 * CloudWatchメトリクスフィルターによるアラーム、EventBridgeルールを使用したセキュリティアラートの定義
 */
interface SecurityAlarmProps {
  notifyEmail: string;
  cloudTrailLogGroupName: string;
}

export class SecurityAlarm extends Construct {
  constructor(scope: Construct, id: string, props: SecurityAlarmProps) {
    super(scope, id);

    //1 Create a SNS topic for security alarm
    const alarmTopic = new AlarmTopic(this, 'SnsTopic', props.notifyEmail);

    //2 Set EventBridge Rules
    new EventBridgeRules(this, 'EventBridgeRules', alarmTopic.snsTopic);

    // LogGroup Construct for CloudTrail
    //   Use LogGroup.fromLogGroupName() because...
    //   On ControlTower environment, it created by not BLEA for FSI but ControlTower. So we need to refer existent LogGroup.
    //   When you use BLEA Standalone version, the LogGroup is created by BLEA for FSI.
    const cloudTrailLogGroup = cwl.LogGroup.fromLogGroupName(this, 'CloudTrailLogGroup', props.cloudTrailLogGroupName);

    //3 Set CloudWatch alarm with metrics filter
    new CweAlerm(this, 'CWAlarm', alarmTopic.snsTopic, cloudTrailLogGroup);
  }
}

/////////// private Construct /////////////////

/*
 * メトリクスフィルターによる CloudWatch アラームの定義
 *  1 IAM Policy Change Notification
 *  2 Unauthorized Attempts
 *  3 NewAccessKeyCreated
 *  4 Detect Root Activity from CloudTrail Log (For SecurityHub CIS 1.1)
 */
class CweAlerm extends Construct {
  constructor(scope: Construct, id: string, secTopic: sns.Topic, cloudTrailLogGroup: cdk.aws_logs.ILogGroup) {
    super(scope, id);

    // 1 IAM Policy Change Notification
    //  from NIST template
    const mfIAMPolicyChange = new cwl.MetricFilter(this, 'MetricFilterIAMPolicyChanged', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString:
          '{($.eventName=DeleteGroupPolicy)||($.eventName=DeleteRolePolicy)||($.eventName=DeleteUserPolicy)||($.eventName=PutGroupPolicy)||($.eventName=PutRolePolicy)||($.eventName=PutUserPolicy)||($.eventName=CreatePolicy)||($.eventName=DeletePolicy)||($.eventName=CreatePolicyVersion)||($.eventName=DeletePolicyVersion)||($.eventName=AttachRolePolicy)||($.eventName=DetachRolePolicy)||($.eventName=AttachUserPolicy)||($.eventName=DetachUserPolicy)||($.eventName=AttachGroupPolicy)||($.eventName=DetachGroupPolicy)}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'IAMPolicyEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'CWAlarmIAMPolicyChanged', {
      metric: mfIAMPolicyChange.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'IAM Configuration changes detected!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // 2 Unauthorized Attempts
    //  from NIST template
    const mfUnauthorizedAttempts = new cwl.MetricFilter(this, 'MetricFilterUnauthorizedAttempts', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString: '{($.errorCode=AccessDenied)||($.errorCode=UnauthorizedOperation)}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'UnauthorizedAttemptsEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'CWAlarmUnauthorizedAttempts', {
      metric: mfUnauthorizedAttempts.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 5,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Multiple unauthorized actions or logins attempted!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // 3 NewAccessKeyCreated
    //  from NIST template
    const mfNewAccessKeyCreated = new cwl.MetricFilter(this, 'MetricFilterNewAccessKeyCreated', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString: '{($.eventName=CreateAccessKey)}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'NewAccessKeyCreatedEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'CWAlarmNewAccessKeyCreated', {
      metric: mfNewAccessKeyCreated.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Warning: New IAM access Eey was created. Please be sure this action was neccessary.',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));

    // 4 Detect Root Activity from CloudTrail Log (For SecurityHub CIS 1.1)
    // See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html#securityhub-standards-cis-controls-1.1
    // See: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudwatch-alarms-for-cloudtrail-additional-examples.html
    const mfRooUserPolicy = new cwl.MetricFilter(this, 'MetricFilterRootUserActivity', {
      logGroup: cloudTrailLogGroup,
      filterPattern: {
        logPatternString:
          '{$.userIdentity.type="Root" && $.userIdentity.invokedBy NOT EXISTS && $.eventType !="AwsServiceEvent"}',
      },
      metricNamespace: 'CloudTrailMetrics',
      metricName: 'RootUserPolicyEventCount',
      metricValue: '1',
    });

    new cw.Alarm(this, 'CWAlarmRootUserActivity', {
      metric: mfRooUserPolicy.metric({
        period: cdk.Duration.seconds(300),
        statistic: cw.Statistic.SUM,
      }),
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Root user activity detected!',
      actionsEnabled: true,
    }).addAlarmAction(new cwa.SnsAction(secTopic));
  }
}

/*
 * EventBridge ルールの定義
 *  1 ConfigRule compliance Change
 *  2 AWS Health - Notify any events on AWS Health
 *  3 Security Groups Change Notification
 *  4 Network ACL Change Notification
 *  5 CloudTrail configuration Change
 *  6 Security Hub Findings: High or Critical
 *  7 GuardDuty Findings
 */
class EventBridgeRules extends Construct {
  constructor(scope: Construct, id: string, secTopic: sns.Topic) {
    super(scope, id);

    // 1 --------------- ConfigRule Compliance Change Notification -----------------
    // ConfigRule - Compliance Change
    //  See: https://docs.aws.amazon.com/config/latest/developerguide/monitor-config-with-cloudwatchevents.html
    //  See: https://aws.amazon.com/premiumsupport/knowledge-center/config-resource-non-compliant/?nc1=h_ls
    //  通知するルールを追加したい場合は、'configRuleName'配列にルール名を追加して下さい
    //  Sample Rule 'bb-default-security-group-closed' は lib/bleafsi-config-rules-stack.ts を参照
    new cwe.Rule(this, 'ConfigRuleComplianceChage', {
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

    // 2 ------------------------ AWS Health Notification ---------------------------

    // AWS Health - Notify any events on AWS Health
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/cloudwatch-notification-scheduled-events/?nc1=h_ls
    new cwe.Rule(this, 'AWSHealthEvent', {
      description: 'Notify AWS Health event',
      enabled: true,
      eventPattern: {
        source: ['aws.health'],
        detailType: ['AWS Health Event'],
      },
      targets: [new cwet.SnsTopic(secTopic)],
    });

    // 3 ------------ Detective guardrails from NIST standard template ----------------
    // See: https://aws.amazon.com/blogs/publicsector/automating-compliance-architecting-for-fedramp-high-and-nist-workloads-in-aws-govcloud-us/

    // Security Groups Change Notification
    // See: https://aws.amazon.com/premiumsupport/knowledge-center/monitor-security-group-changes-ec2/?nc1=h_ls
    //  from NIST template
    new cwe.Rule(this, 'SecurityGroupChanged', {
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

    // 4 Network ACL Change Notification
    //  from NIST template
    new cwe.Rule(this, 'NACLChanged', {
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

    // ------------------- Other security services integration ----------------------
    // 5 CloudTrail configuration Change
    //  from NIST template
    new cwe.Rule(this, 'CloudTrailChanged', {
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
    });

    // 6 SecurityHub - Imported
    //   Security Hub automatically sends all new findings and all updates to existing findings to EventBridge as Security Hub Findings - Imported events.
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cwe-integration-types.html
    //
    //   Security Hub Finding format
    //   See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-findings-format.html
    new cwe.Rule(this, 'SecurityHubFindings', {
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

    // 7 GuardDuty Findings
    //   Will alert for any Medium to High finding.
    //   See: https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_findings_cloudwatch.html
    new cwe.Rule(this, 'GuardDutyFindings', {
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

/*
 * Security Alarm用の SNS Topic作成
 */
class AlarmTopic extends Construct {
  readonly snsTopic: sns.Topic;

  constructor(scope: Construct, id: string, notifyEmail: string) {
    super(scope, id);

    // SNS Topic for Security Alarm
    const topic = new sns.Topic(this, 'Default');
    new sns.Subscription(this, 'EmailSubscription', {
      endpoint: notifyEmail,
      protocol: sns.SubscriptionProtocol.EMAIL,
      topic: topic,
    });
    this.snsTopic = topic;

    // attach policy: Allow to publish message from CloudWatch
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );

    // attach policy: Allow to publish through ssl
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowPublishThroughSSLOnly',
        actions: ['SNS:Publish'],
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        resources: [topic.topicArn],
        conditions: {
          Bool: {
            'aws:SecureTransport': false,
          },
        },
      }),
    );
  }
}
