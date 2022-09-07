import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';

import { ConfigStack } from '../lib/bleafsi-config-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const pjPrefix = 'BLEA-FSI-BASE';

let stack: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('GuestOsa3Account Stacks', () => {
    stack = new ConfigStack(app, `${pjPrefix}-config-stack`, {
      cloudTrailBucketName: 'dummy bucket', //S3 bucket name created by cdk template in Log Archive account
      env: procEnv,
    });

    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });
});

//cdk-nag check
describe(`${pjPrefix} cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
    //cdk-nag suppression
    // IAM4: The IAM user, role, or group uses AWS managed policies.
    NagSuppressions.addResourceSuppressionsByPath(stack, '/BLEA-FSI-BASE-config-stack/ConfigRole/Resource', [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'this stack is used for administrative task. this role uses service-linked role',
      },
    ]);

    //cdk-nag check
    cdk.Aspects.of(stack).add(new AwsSolutionsChecks());
  });

  test('No unsupressed Errors', () => {
    const errors1 = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors1).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack.stackName);
    } catch (e) {
      console.error(errors1);
      throw e;
    }
  });
});
