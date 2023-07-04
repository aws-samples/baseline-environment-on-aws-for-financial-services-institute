import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { PjPrefix } from '../bin/parameter';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { SimpleDataLakeStack } from '../lib/bleafsi-guest-simple-datalake-stack';

const app = new cdk.App();

// ----------------------- Environment variables for stack ------------------------------
let stack: SimpleDataLakeStack;

describe(`${PjPrefix} snapshot check`, () => {
  test('Sample Stacks', () => {
    stack = new SimpleDataLakeStack(app, `${PjPrefix}`, {
      envName: 'test',
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
      simpleDataLake: {
        notifyEmail: 'example@amazon.com',
        vpcCidr: '10.4.0.0/16',
      },
    });

    // test with snapshot
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });
});

describe(`${PjPrefix} cdk-nag AwsSolutions Pack`, () => {
  beforeAll(() => {
    //cdk-nag suppression
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/QuickSight Role Policy/QuickSightRole/Default/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wild card permission is neccessary',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/QuickSight Role Policy/QuickSightRole/ManagedPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Wild card permission is neccessary',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      'BLEAFSI-AnalyticsPlatform/QuickSight Role Policy/QuickSightRole/Default/Resource',
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Valid use of AWSQuickSightAthenaPolicy',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/BucketForOriginData/AccessLogs/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/BucketForRawData/AccessLogs/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/BucketForNormalizedData/AccessLogs/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/BucketForAnalytics/AccessLogs/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/BucketForMasterData/AccessLogs/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/BucketForAthenaQueryOutput/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/GluePipeline/BucketForGlueAssest/AccessLogs/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/GluePipeline/BucketForSparkUILog/AccessLogs/Default/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'Target bucket is an access log bucket' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      [
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForOriginData/glueJobRole/Default/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForRawData/glueJobRole/Default/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForNormalizedData/glueJobRole/Default/Resource',
        '/BLEAFSI-AnalyticsPlatform/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/Resource',
      ],
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'this stack is used for administrative task. this role uses service-linked role',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      [
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForOriginData/glueJobRole/Policy/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForRawData/glueJobRole/Policy/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForNormalizedData/glueJobRole/Policy/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForOriginData/glueJobRole/Default/DefaultPolicy/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForRawData/glueJobRole/Default/DefaultPolicy/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/IamRoleForNormalizedData/glueJobRole/Default/DefaultPolicy/Resource',
        '/BLEAFSI-AnalyticsPlatform/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/DefaultPolicy/Resource',
        '/BLEAFSI-AnalyticsPlatform/GluePipeline/gluejobpipeline/Role/DefaultPolicy/Resource',
      ],
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'this IAM policies are used to get all the data from bucket',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/GluePipeline/gluejobpipeline/Resource',
      [{ id: 'AwsSolutions-SF2', reason: 'X-ray is an option' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/GluePipeline/cloudwatch alarm/Default/Resource',
      [{ id: 'AwsSolutions-SNS2', reason: 'SNS encryption is an option' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      stack,
      '/BLEAFSI-AnalyticsPlatform/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'SNS encryption is an option' }],
    );

    //cdk-nag check
    cdk.Aspects.of(stack).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + stack.stackName);
    } catch (e) {
      const errorMessages = errors.map((e) => ({
        type: e.entry.type,
        data: e.entry.data,
        id: e.id,
      }));
      console.error(JSON.stringify(errorMessages, undefined, 2));
      throw e;
    }
  });
});
