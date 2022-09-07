import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';

import { IamStack } from '../../base-ct-guest/lib/bleafsi-iam-stack';
import { SecurityAlarmStack } from '../lib/bleafsi-security-alarm-stack';
import { ConfigCtGuardrailStack } from '../lib/bleafsi-config-ct-guardrail-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const pjPrefix = 'BLEA-FSI-BASE';

let stack1: cdk.Stack;
let stack2: cdk.Stack;
let stack3: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('GuestOsa1Account Stacks', () => {
    stack1 = new IamStack(app, `${pjPrefix}-iam`, { env: procEnv });
    stack2 = new ConfigCtGuardrailStack(app, `${pjPrefix}-configCtGuardrails`, { env: procEnv });
    stack3 = new SecurityAlarmStack(app, `${pjPrefix}-securityAlarm`, {
      notifyEmail: 'dummy@amazon.co.jp',
      env: procEnv,
    });

    // test with snapshot
    expect(Template.fromStack(stack1)).toMatchSnapshot();
    expect(Template.fromStack(stack2)).toMatchSnapshot();
    expect(Template.fromStack(stack3)).toMatchSnapshot();
  });
});

//cdk-nag check
describe(`${pjPrefix} cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
    //cdk-nag suppression
    // IAM5: The IAM entity contains wildcard permissions and does not have a cdk-nag rule suppression with evidence for those permission.
    // SNS2: The SNS Topic does not have server-side encryption enabled.
    //for stack1
    NagSuppressions.addStackSuppressions(stack1, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'this stack is used for administrative task',
      },
    ]);
    //for stack3
    NagSuppressions.addResourceSuppressionsByPath(stack3, '/BLEA-FSI-BASE-securityAlarm/SecurityAlarmTopic/Resource', [
      {
        id: 'AwsSolutions-SNS2',
        reason: 'SNS encryption is an option',
      },
    ]);

    //cdk-nag check
    cdk.Aspects.of(stack1).add(new AwsSolutionsChecks());
    cdk.Aspects.of(stack2).add(new AwsSolutionsChecks());
    cdk.Aspects.of(stack3).add(new AwsSolutionsChecks());
  });

  test('No unsupressed Errors', () => {
    const errors1 = Annotations.fromStack(stack1).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors1).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack1.stackName);
    } catch (e) {
      console.error(errors1);
      throw e;
    }
  });

  test('No unsupressed Errors', () => {
    const errors2 = Annotations.fromStack(stack2).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors2).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack2.stackName);
    } catch (e) {
      console.error(errors2);
      throw e;
    }
  });

  test('No unsupressed Errors', () => {
    const errors3 = Annotations.fromStack(stack3).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors3).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack3.stackName);
    } catch (e) {
      console.error(errors3);
      throw e;
    }
  });
});
