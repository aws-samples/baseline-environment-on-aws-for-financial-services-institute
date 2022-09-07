import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';

import { S3BucketStack } from '../lib/bleafsi-s3bucket-stack';

const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();
const pjPrefix = 'BLEA-FSI-BASE';

let s3BucketStack: cdk.Stack;

//jest snapshot check
describe(`${pjPrefix} ControlTower Stacks`, () => {
  test('LoggingAccount Stacks', () => {
    s3BucketStack = new S3BucketStack(app, `${pjPrefix}-S3Bucket`, { env: procEnv });

    // test with snapshot
    expect(Template.fromStack(s3BucketStack)).toMatchSnapshot();
  });
});

//cdk-nag check
describe(`${pjPrefix} cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
    //cdk-nag suppression
    // S1: The S3 Bucket has server access logs disabled.
    NagSuppressions.addResourceSuppressionsByPath(s3BucketStack, '/BLEA-FSI-BASE-S3Bucket/ArchiveLogsBucket/Resource', [
      {
        id: 'AwsSolutions-S1',
        reason: 'this s3 bucket is used to store server access log itself',
      },
    ]);

    //cdk-nag check
    cdk.Aspects.of(s3BucketStack).add(new AwsSolutionsChecks());
  });

  test('No unsupressed Errors', () => {
    const errors1 = Annotations.fromStack(s3BucketStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors1).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + s3BucketStack.stackName);
    } catch (e) {
      console.error(errors1);
      throw e;
    }
  });
});
