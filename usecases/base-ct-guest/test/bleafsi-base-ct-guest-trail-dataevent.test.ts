import * as cdk from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';

import { TrailDataEventStack } from '../lib/bleafsi-trail-dataevent-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const pjPrefix = 'BLEA-FSI-BASE';

let stack: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('Guest2Account Stacks', () => {
    stack = new TrailDataEventStack(app, `${pjPrefix}-trail`, {
      targetBuckets: ['dummy-bucket'],
      cloudTrailBucketName: 'dummy-bucket',
      controlTowerKMSKeyArn: 'arn:aws:kms:ap-northeast-1:701111111111:key/11111111-1111-2222-3333-123456789012',
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
