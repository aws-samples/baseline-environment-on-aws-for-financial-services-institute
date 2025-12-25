import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks } from 'cdk-nag';
import { NagSuppressions } from 'cdk-nag';
import { S3Stack } from './s3-stack';
import { VpcStack } from './vpc-stack';
import { KmsKeyStack } from './kms-key-stack';
import { IamRoleStack } from './iam-role-stack';
import { EcrStack } from './ecr-stack';
import { WafStack } from './waf-stack';

/*
 * Jest (npm run test で実行される)テストケース
 */
const app = new cdk.App();

let s3Stack: S3Stack;
let vpcStack: VpcStack;
let kmsKeyStack: KmsKeyStack;
let iamRoleStack: IamRoleStack;
let ecrStack: EcrStack;
let wafStack: WafStack;

const defaultEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

//jest snapshot check
describe(`Compare Snapshot test`, () => {
  test('GuestAccount Stacks', () => {
    //create stacks
    s3Stack = new S3Stack(app, `Jest-Snapshot-S3`, {
      env: defaultEnv,
    });
    vpcStack = new VpcStack(app, `Jest-Snapshot-VPC`, {
      env: defaultEnv,
    });
    kmsKeyStack = new KmsKeyStack(app, `Jest-Snapshot-KMS`, {
      env: defaultEnv,
    });
    iamRoleStack = new IamRoleStack(app, `Jest-Snapshot-Iam`, {
      env: defaultEnv,
    });
    ecrStack = new EcrStack(app, `Jest-Snapshot-Ecr`, {
      env: defaultEnv,
    });
    wafStack = new WafStack(app, `Jest-Snapshot-Waf`, {
      env: defaultEnv,
    });

    // test with snapshot
    expect(Template.fromStack(s3Stack)).toMatchSnapshot();
    expect(Template.fromStack(vpcStack)).toMatchSnapshot();
    expect(Template.fromStack(kmsKeyStack)).toMatchSnapshot();
    expect(Template.fromStack(iamRoleStack)).toMatchSnapshot();
    expect(Template.fromStack(ecrStack)).toMatchSnapshot();
    expect(Template.fromStack(wafStack)).toMatchSnapshot();
  });
});

//cdk-nag check
describe(`cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
    //cdk-nag suppression
    for (const bucket of s3Stack.buckets) {
      NagSuppressions.addResourceSuppressions(bucket.accessLogbucket, [
        { id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' },
      ]);
    }
    for (const iamRole of iamRoleStack.iamRoles) {
      NagSuppressions.addResourceSuppressions(iamRole.iamRole, [
        { id: 'AwsSolutions-IAM4', reason: 'This is a test stack. It uses AWS Managegd policy' },
      ]);
    }

    //cdk-nag check
    cdk.Aspects.of(s3Stack).add(new AwsSolutionsChecks());
    cdk.Aspects.of(vpcStack).add(new AwsSolutionsChecks());
    cdk.Aspects.of(kmsKeyStack).add(new AwsSolutionsChecks());
    cdk.Aspects.of(iamRoleStack).add(new AwsSolutionsChecks());
    cdk.Aspects.of(ecrStack).add(new AwsSolutionsChecks());
    cdk.Aspects.of(wafStack).add(new AwsSolutionsChecks());
  });

  test('No unsupressed Errors', () => {
    //For S3 Stack
    const errors1 = Annotations.fromStack(s3Stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors1).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + s3Stack.stackName);
    } catch (e) {
      console.error(errors1);
      throw e;
    }

    //For VPC Stack
    const errors2 = Annotations.fromStack(vpcStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors2).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + vpcStack.stackName);
    } catch (e) {
      console.error(errors2);
      throw e;
    }

    //For KmsKey Stack
    const errors3 = Annotations.fromStack(kmsKeyStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors3).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + kmsKeyStack.stackName);
    } catch (e) {
      console.error(errors3);
      throw e;
    }
    //For IamRole Stack
    const errors4 = Annotations.fromStack(iamRoleStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors4).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + iamRoleStack.stackName);
    } catch (e) {
      console.error(errors4);
      throw e;
    }

    //For Ecr Stack
    const errors5 = Annotations.fromStack(ecrStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors5).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + ecrStack.stackName);
    } catch (e) {
      console.error(errors5);
      throw e;
    }

    //For Waf Stack
    const errors6 = Annotations.fromStack(wafStack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors6).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + wafStack.stackName);
    } catch (e) {
      console.error(errors6);
      throw e;
    }
  });
});
