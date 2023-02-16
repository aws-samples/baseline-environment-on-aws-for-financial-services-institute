import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';
import { BaseCTStack } from '../lib/bleafsi-base-ct-guest-stack';

const app = new cdk.App();
const pjPrefix = 'BLEAFSI-BASE';

let stack: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} Compare Snapshot test`, () => {
  test('GuestAccount Stacks', () => {
    //create stacks
    stack = new BaseCTStack(app, `${pjPrefix}-Dev`, {
      notifyEmail: 'dummy@amazon.co.jp',
      cloudTrailBucketName: 'dummy-bucket',
      targetBuckets: ['dummy-bucket'],
      controlTowerKMSKeyArn: 'arn:aws:kms:ap-northeast-1:701111111111:key/11111111-1111-2222-3333-123456789012',
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
    });

    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });
});

//cdk-ng check
describe(`${pjPrefix} cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
    //cdk-nag suppression
    // IAM5: The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission.
    // IAM4: The IAM user, role, or group uses AWS managed policies.
    // SNS2: The SNS Topic does not have server-side encryption enabled.
    // S1: The S3 Bucket has server access logs disabled.

    NagSuppressions.addStackSuppressions(stack, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'this stack is used for administrative task',
      },
    ]);
    //for security-auto-remediation construct
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-BASE-Dev/SecurityAutoRemediation/AutoRemediation/IamRole/Resource',
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'this stack is used for administrative task',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-BASE-Dev/SecurityAutoRemediation/AutoRemediation/IamRole/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'this stack is used for administrative task',
        },
      ],
    );
    //for security-alarm construct
    NagSuppressions.addResourceSuppressionsByPath(stack, '/BLEAFSI-BASE-Dev/SecurityAlarm/SnsTopic/Default/Resource', [
      {
        id: 'AwsSolutions-SNS2',
        reason: 'SNS encryption is an option',
      },
    ]);
    //for cloudtrail-trail construct
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-BASE-Dev/CloudTrail/Bucket/AccessLogs/Default/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'this stack is used for administrative task',
        },
        {
          id: 'AwsSolutions-S1',
          reason: 'this s3 bucket is used to store server access log itself',
        },
      ],
    );
    //for session-manager-log construct
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-BASE-Dev/SessionManagerLog/Bucket/AccessLogs/Default/Resource',
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'this s3 bucket is used to store server access log itself',
        },
      ],
    );

    //cdk-nag check
    cdk.Aspects.of(stack).add(new AwsSolutionsChecks());
  });

  test('No unsupressed Errors', () => {
    const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack.stackName);
    } catch (e) {
      console.error(errors);
      throw e;
    }
  });
});
