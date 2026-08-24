import { Stack } from 'aws-cdk-lib';
import { NagSuppressions } from 'cdk-nag';

/**
 * cdk-nag AwsSolutions パック用の正当な抑制設定。
 * 各抑制には理由を明記し、セキュリティリスクが受容可能であることを文書化する。
 */
export function applyNagSuppressions(stack: Stack): void {
  NagSuppressions.addStackSuppressions(stack, [
    {
      id: 'AwsSolutions-IAM4',
      reason:
        'AWS Managed Policies (AWSLambdaBasicExecutionRole, AWSLambdaVPCAccessExecutionRole, AWSBackupServiceRolePolicyForBackup) are required for Lambda and Backup service operation. Custom policies would duplicate managed policy content.',
      appliesTo: [
        'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
        'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole',
        'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup',
      ],
    },
    {
      id: 'AwsSolutions-IAM5',
      reason:
        'Wildcard permissions are required for: (1) NACL operations need network-acl/* as ACL IDs are dynamic, (2) CDK Provider framework Lambda invoke permission uses function ARN with :* suffix for all versions.',
    },
    {
      id: 'AwsSolutions-L1',
      reason:
        'NODEJS_20_X is the latest LTS runtime supported by CDK Provider framework. CDK-managed Provider Lambda uses internal runtime selection. Custom Lambdas use NODEJS_20_X which is actively supported until 2026-10.',
    },
    {
      id: 'AwsSolutions-SNS3',
      reason:
        'SNS topic is used exclusively for CloudWatch Alarm notifications within the same account and region. All API calls to SNS are made via VPC Endpoint (HTTPS enforced at transport level). The topic does not receive messages from external publishers.',
    },
  ]);
}
