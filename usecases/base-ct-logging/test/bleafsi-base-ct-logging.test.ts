import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';
import { BaseCTStack } from '../lib/bleafsi-base-ct-logging-stack';

const app = new cdk.App();
const pjPrefix = 'BLEAFSI-BASE';

let stack: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} Compare Snapshot test`, () => {
  test('LoggingAccount Stacks', () => {
    stack = new BaseCTStack(app, `${pjPrefix}-Dev`, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
    });

    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });
});

//cdk-nag check
describe(`${pjPrefix} cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
    //cdk-nag suppression
    // S1: The S3 Bucket has server access logs disabled.
    NagSuppressions.addResourceSuppressionsByPath(stack, '/BLEAFSI-BASE-Dev/Bucket/AccessLogs/Default/Resource', [
      {
        id: 'AwsSolutions-S1',
        reason: 'this s3 bucket is used to store server access log itself',
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
