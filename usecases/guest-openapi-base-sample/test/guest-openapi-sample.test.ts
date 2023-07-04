import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { SampleOpenApiStack } from '../lib/bleafsi-openapi-base-sample-stack';
import { DevParameter } from '../bin/parameter';

const app = new cdk.App({
  context: {
    pjPrefix: 'BLEA-FSI',
    customdomainname: 'api.xxx.xxx',
    alterdomainname: 'openapi-base.xxx.xxx',
    'certIdarn-apigw': 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    'certIdarn-cf': 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  },
});

let apiApp: SampleOpenApiStack;

/*const appProps: OpenApiBaseContextProps = {
  customdomainName: 'api.xxx.xxx',
  alterdomainName: 'openapi-base.xxx.xxx',
  certIdarnApigw: 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  certIdarnCf: 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
};*/
describe(`BLEA-FSI snapshot check`, () => {
  test('OpenAPI sample Stacks', () => {
    apiApp = new SampleOpenApiStack(app, 'SampleOpenApiStack', DevParameter);

    // test with snapshot
    expect(Template.fromStack(apiApp)).toMatchSnapshot();
  });
});

// cdk-nag suppression
describe(`BLEA-FSI cdk-nag AwsSolutions Pack: api`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      apiApp,
      '/SampleOpenApiStack/Cognito Pool/userPool/smsRole/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/Cognito Pool/userPool/Resource', [
      { id: 'AwsSolutions-COG2', reason: 'It is a sample build project.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/Cognito Pool/userPool/Resource', [
      { id: 'AwsSolutions-COG3', reason: 'It is a sample build project.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(
      apiApp,
      '/SampleOpenApiStack/Cognito Pool/HelloHandler/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/ApiGateway/sample-api/Resource', [
      { id: 'AwsSolutions-APIG2', reason: 'It is a sample build project.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(
      apiApp,
      '/SampleOpenApiStack/ApiGateway/sample-api/CloudWatchRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is a sample build project.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      apiApp,
      '/SampleOpenApiStack/ApiGateway/sample-api/DeploymentStage.prod/Resource',
      [{ id: 'AwsSolutions-APIG3', reason: 'cdk-nag tool bug.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/CloudFront/AppLogBucket/Resource', [
      { id: 'AwsSolutions-S1', reason: 'It is a log bucket.' },
    ]);

    cdk.Aspects.of(apiApp).add(new AwsSolutionsChecks());
  });

  test('No unsuppressed Errors', () => {
    const errors = Annotations.fromStack(apiApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + apiApp.stackName);
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
