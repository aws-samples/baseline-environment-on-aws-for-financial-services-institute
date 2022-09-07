import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { SampleOpenApiStack } from '../lib/bleafsi-openapi-base-sample-stack';
import { SampleWafApigwStack } from '../lib/bleafsi-waf-apigw-sample-stack';
//import { SampleWafCfStack } from '../lib/bleafsi-waf-cf-sample-stack';
import { SampleCfStack } from '../lib/bleafsi-cloudfront-sample-stack';
import { OpenApiBaseContextProps } from '../lib/shared/bleafsi-types';

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
let wafapigwApp: SampleWafApigwStack;
//let wafcfApp: SampleWafCfStack;
let cfApp: SampleCfStack;

const appProps: OpenApiBaseContextProps = {
  customdomainName: 'api.xxx.xxx',
  alterdomainName: 'openapi-base.xxx.xxx',
  certIdarnApigw: 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  certIdarnCf: 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
};
describe(`BLEA-FSI snapshot check`, () => {
  test('OpenAPI sample Stacks', () => {
    apiApp = new SampleOpenApiStack(app, 'SampleOpenApiStack', appProps);
    wafapigwApp = new SampleWafApigwStack(app, 'Wafv2ApigwStack', {
      restApiId: apiApp.sample_api.restApiId,
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
      },
    });
    //wafcfApp = new SampleWafCfStack(app, 'Wafv2CfStack', {
    //  env: {
    //    region: 'us-east-1',
    //  },
    //});
    cfApp = new SampleCfStack(app, 'SampleCfStack', appProps);

    // test with snapshot
    expect(Template.fromStack(apiApp)).toMatchSnapshot();
    expect(Template.fromStack(wafapigwApp)).toMatchSnapshot();
    //expect(Template.fromStack(wafcfApp)).toMatchSnapshot();
    expect(Template.fromStack(cfApp)).toMatchSnapshot();
  });
});

// cdk-nag suppression
describe(`BLEA-FSI cdk-nag AwsSolutions Pack: api`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/userPool/smsRole/Resource', [
      { id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/userPool/Resource', [
      { id: 'AwsSolutions-COG2', reason: 'It is a sample build project.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/userPool/Resource', [
      { id: 'AwsSolutions-COG3', reason: 'It is a sample build project.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/HelloHandler/ServiceRole/Resource', [
      { id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/sample-api/Resource', [
      { id: 'AwsSolutions-APIG2', reason: 'It is a sample build project.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(apiApp, '/SampleOpenApiStack/sample-api/CloudWatchRole/Resource', [
      { id: 'AwsSolutions-IAM4', reason: 'It is a sample build project.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(
      apiApp,
      '/SampleOpenApiStack/sample-api/DeploymentStage.prod/Resource',
      [{ id: 'AwsSolutions-APIG3', reason: 'cdk-nag tool bug.' }],
    );
    cdk.Aspects.of(apiApp).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
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

describe(`BLEA-FSI cdk-nag AwsSolutions Pack: cf`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(cfApp, '/SampleCfStack/AppLogBucket/Resource', [
      { id: 'AwsSolutions-S1', reason: 'It is a log bucket.' },
    ]);
    NagSuppressions.addResourceSuppressionsByPath(cfApp, '/SampleCfStack/OpenApiDistribution/Resource', [
      { id: 'AwsSolutions-CFR2', reason: 'WAF is attache to APIGW.' },
    ]);
    cdk.Aspects.of(cfApp).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(cfApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + cfApp.stackName);
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

describe(`BLEA-FSI cdk-nag AwsSolutions Pack: wafapigw`, () => {
  beforeAll(() => {
    cdk.Aspects.of(wafapigwApp).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(wafapigwApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + wafapigwApp.stackName);
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

//describe(`BLEA-FSI cdk-nag AwsSolutions Pack: wafcf`, () => {
//  beforeAll(() => {
//    cdk.Aspects.of(wafcfApp).add(new AwsSolutionsChecks());
//  });
//
//  test('No unsurpressed Errors', () => {
//    const errors = Annotations.fromStack(wafcfApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
//    try {
//      expect(errors).toHaveLength(0);
//      console.log('cdk-nag: no errors for stack ' + wafcfApp.stackName);
//    } catch (e) {
//      const errorMessages = errors.map((e) => ({
//        type: e.entry.type,
//        data: e.entry.data,
//        id: e.id,
//      }));
//      console.error(JSON.stringify(errorMessages, undefined, 2));
//      throw e;
//    }
//  });
//});
