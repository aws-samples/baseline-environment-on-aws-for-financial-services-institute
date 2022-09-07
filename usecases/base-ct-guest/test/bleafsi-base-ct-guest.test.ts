import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';

import { IamStack } from '../lib/bleafsi-iam-stack';
import { ConfigRulesStack } from '../lib/bleafsi-config-rules-stack';
import { SecurityAlarmStack } from '../lib/bleafsi-security-alarm-stack';
import { SessionManagerLogStack } from '../lib/bleafsi-session-manager-log-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const pjPrefix = 'BLEA-FSI-BASE';

let stack1: cdk.Stack;
let stack2: cdk.Stack;
let stack3: cdk.Stack;
let stack4: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('GuestAccount Stacks', () => {
    //create stacks
    stack1 = new IamStack(app, `${pjPrefix}-iam`, { env: procEnv });
    stack2 = new ConfigRulesStack(app, `${pjPrefix}-configRule`, { env: procEnv });
    stack3 = new SecurityAlarmStack(app, `${pjPrefix}-securityAlarm`, {
      notifyEmail: 'dummy@amazon.co.jp',
      cloudTrailLogGroupName: 'dummy/logs',
      env: procEnv,
    });
    stack4 = new SessionManagerLogStack(app, `${pjPrefix}-sessionManagerLog`, { env: procEnv });

    // test with snapshot
    expect(Template.fromStack(stack1)).toMatchSnapshot();
    expect(Template.fromStack(stack2)).toMatchSnapshot();
    expect(Template.fromStack(stack3)).toMatchSnapshot();
    expect(Template.fromStack(stack4)).toMatchSnapshot();
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
    //for stack1
    NagSuppressions.addStackSuppressions(stack1, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'this stack is used for administrative task',
      },
    ]);
    //for stack2
    NagSuppressions.addResourceSuppressionsByPath(
      stack2,
      '/BLEA-FSI-BASE-configRule/RemoveSecGroupRemediationRole/Resource',
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'this stack is used for administrative task',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack2,
      '/BLEA-FSI-BASE-configRule/RemoveSecGroupRemediationRole/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'this stack is used for administrative task',
        },
      ],
    );
    //for stack3
    NagSuppressions.addResourceSuppressionsByPath(stack3, '/BLEA-FSI-BASE-securityAlarm/SecurityAlarmTopic/Resource', [
      {
        id: 'AwsSolutions-SNS2',
        reason: 'SNS encryption is an option',
      },
    ]);
    //for stack4
    NagSuppressions.addResourceSuppressionsByPath(stack4, '/BLEA-FSI-BASE-sessionManagerLog/WritePolicy/Resource', [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'this stack is used for administrative task',
      },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(
      stack4,
      '/BLEA-FSI-BASE-sessionManagerLog/ArchiveLogsBucket/Resource',
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'this s3 bucket is used to store server access log itself',
        },
      ],
    );

    //cdk-nag check
    cdk.Aspects.of(stack1).add(new AwsSolutionsChecks());
    cdk.Aspects.of(stack2).add(new AwsSolutionsChecks());
    cdk.Aspects.of(stack3).add(new AwsSolutionsChecks());
    cdk.Aspects.of(stack4).add(new AwsSolutionsChecks());
  });

  test('No unsupressed Errors', () => {
    const errors1 = Annotations.fromStack(stack1).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    const errors2 = Annotations.fromStack(stack2).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    const errors3 = Annotations.fromStack(stack3).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    const errors4 = Annotations.fromStack(stack4).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors1).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack1.stackName);
    } catch (e) {
      console.error(errors1);
      throw e;
    }
    try {
      expect(errors2).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack2.stackName);
    } catch (e) {
      console.error(errors2);
      throw e;
    }
    try {
      expect(errors3).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack3.stackName);
    } catch (e) {
      console.error(errors3);
      throw e;
    }
    try {
      expect(errors4).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack4.stackName);
    } catch (e) {
      console.error(errors4);
      throw e;
    }
  });
});
