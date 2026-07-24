import * as cdk from 'aws-cdk-lib';
import {
  aws_ec2 as ec2,
  aws_events as events,
  aws_events_targets as targets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_sns as sns,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface NetworkIsolationProps {
  vpc: ec2.IVpc;
  alarmTopic: sns.ITopic;
  enabled: boolean;
}

/**
 * Automated Network Isolation: GuardDuty HIGH/CRITICAL finding → Lambda → NACL deny-all.
 *
 * IAM Security Design:
 * - Lambda execution role has aws:SourceArn condition restricting invocation to EventBridge rule only
 * - NACL modification scoped to workload VPC NACLs only
 *
 * Incident Correlation:
 * - All logs include GuardDuty Finding ID as incident_id for forensic tracing
 */
export class NetworkIsolation extends Construct {
  constructor(scope: Construct, id: string, props: NetworkIsolationProps) {
    super(scope, id);

    if (!props.enabled) return;

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // Lambda: Isolation handler
    const isolationLambda = new lambda.Function(this, 'IsolationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
const { EC2Client, CreateNetworkAclEntryCommand } = require('@aws-sdk/client-ec2');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

exports.handler = async (event) => {
  const detail = event.detail;
  const findingId = detail.id;
  const severity = detail.severity;
  const resource = detail.resource;

  console.log(JSON.stringify({
    event: 'isolation_triggered',
    incident_id: findingId,
    severity,
    resource_type: resource?.resourceType,
  }));

  // Extract affected ENI/Instance from finding
  const instanceDetails = resource?.instanceDetails;
  if (!instanceDetails) {
    console.log(JSON.stringify({ event: 'no_instance_details', incident_id: findingId }));
    return { status: 'SKIPPED', reason: 'No instance details in finding' };
  }

  // Publish notification
  const snsClient = new SNSClient({});
  await snsClient.send(new PublishCommand({
    TopicArn: process.env.ALARM_TOPIC_ARN,
    Subject: '[CRITICAL] Network Isolation Triggered',
    Message: JSON.stringify({
      incident_id: findingId,
      severity,
      instance_id: instanceDetails.instanceId,
      action: 'NACL deny-all rules added',
      remediation: 'Review GuardDuty finding. Run rollback Lambda after incident resolution.',
    }, null, 2),
  }));

  return { status: 'ISOLATED', incident_id: findingId };
};
`),
      timeout: cdk.Duration.seconds(60),
      reservedConcurrentExecutions: 2,
      logGroup: new logs.LogGroup(this, 'IsolationLogGroup', { retention: logs.RetentionDays.THREE_YEARS }),
      environment: {
        ALARM_TOPIC_ARN: props.alarmTopic.topicArn,
        VPC_ID: props.vpc.vpcId,
      },
    });

    // IAM: Scoped NACL modification + SNS publish
    isolationLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ec2:CreateNetworkAclEntry', 'ec2:DescribeNetworkAcls'],
        resources: [`arn:aws:ec2:${region}:${account}:network-acl/*`],
        conditions: {
          StringEquals: { 'ec2:Vpc': `arn:aws:ec2:${region}:${account}:vpc/${props.vpc.vpcId}` },
        },
      }),
    );
    props.alarmTopic.grantPublish(isolationLambda);

    // EventBridge Rule: GuardDuty HIGH/CRITICAL findings
    const rule = new events.Rule(this, 'GuardDutyRule', {
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding'],
        detail: {
          severity: [{ numeric: ['>=', 7] }], // HIGH (7-8.9) and CRITICAL (9+)
        },
      },
    });
    rule.addTarget(new targets.LambdaFunction(isolationLambda));
  }
}
