import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';

import { ConfigStackSet } from '../lib/bleafsi-config-stackset';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const pjPrefix = 'BLEA-FSI-BASE';

let stack: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('GuestOsaAccount Stacks', () => {
    stack = new ConfigStackSet(app, `${pjPrefix}-config-stackset`, {
      targetGuestAccountId: '12345',
      env: procEnv,
    });

    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });
});

//cdk-nag check
describe(`${pjPrefix} cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
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
