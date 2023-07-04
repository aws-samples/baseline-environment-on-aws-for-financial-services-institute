import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';
import { BaseCTStack } from '../lib/bleafsi-base-ct-guest-stack';
import { StackParameter, DevParameter } from '../bin/parameter';
import { CloudTrailDataEvent } from '../lib/cloudtrail-dataevent';

const app = new cdk.App();
const pjPrefix = 'BLEAFSI-BASE';

let stack1: cdk.Stack;
let stack2: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} Compare Snapshot test`, () => {
  test('GuestAccount Stacks', () => {
    //set parameter
    DevParameter.envName = 'test';
    DevParameter.securityNotifyEmail = 'dummy@amazon.co.jp';
    DevParameter.cloudTrailBucketName = 'dummy-bucket';
    DevParameter.targetBuckets = ['dummy-bucket'];
    DevParameter.controlTowerKMSKeyArn =
      'arn:aws:kms:ap-northeast-1:701111111111:key/11111111-1111-2222-3333-123456789012';

    //create stacks
    stack1 = new BaseCTStack(app, `${pjPrefix}-basect-Test`, DevParameter);
    stack2 = new LocalTestStack(app, `${pjPrefix}-local-Test`, DevParameter);

    // test with snapshot
    expect(Template.fromStack(stack1)).toMatchSnapshot();
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

    NagSuppressions.addStackSuppressions(stack1, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'this stack is used for administrative task',
      },
    ]);
    //for security-auto-remediation construct
    NagSuppressions.addResourceSuppressionsByPath(
      stack1,
      '/BLEAFSI-BASE-basect-Test/SecurityAutoRemediation/AutoRemediation/IamRole/Resource',
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'this stack is used for administrative task',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack1,
      '/BLEAFSI-BASE-basect-Test/SecurityAutoRemediation/AutoRemediation/IamRole/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'this stack is used for administrative task',
        },
      ],
    );
    //for security-alarm construct
    NagSuppressions.addResourceSuppressionsByPath(
      stack1,
      '/BLEAFSI-BASE-basect-Test/SecurityAlarm/SnsTopic/Default/Resource',
      [
        {
          id: 'AwsSolutions-SNS2',
          reason: 'SNS encryption is an option',
        },
      ],
    );
    //for cloudtrail-trail construct
    NagSuppressions.addResourceSuppressionsByPath(
      stack1,
      '/BLEAFSI-BASE-basect-Test/CloudTrail/Bucket/AccessLogs/Default/Resource',
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
      stack1,
      '/BLEAFSI-BASE-basect-Test/SessionManagerLog/Bucket/AccessLogs/Default/Resource',
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'this s3 bucket is used to store server access log itself',
        },
      ],
    );

    //cdk-nag check
    cdk.Aspects.of(stack1).add(new AwsSolutionsChecks());
  });

  test('No unsupressed Errors', () => {
    const errors = Annotations.fromStack(stack1).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack1.stackName);
    } catch (e) {
      console.error(errors);
      throw e;
    }
  });
});

//CloudTrailDataEvent コンストラクトテスト用のstack
class LocalTestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackParameter) {
    super(scope, id, props);

    new CloudTrailDataEvent(this, `CloudTrail-DataEvent`, {
      cloudTrailBucketName: props.cloudTrailBucketName,
      targetBuckets: props.targetBuckets,
      controlTowerKMSKeyArn: props.controlTowerKMSKeyArn,
    });
  }
}
