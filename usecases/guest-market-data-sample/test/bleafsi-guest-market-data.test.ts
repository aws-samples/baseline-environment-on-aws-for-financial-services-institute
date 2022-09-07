import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { GuestMarketDataStack } from '../lib/bleafsi-guest-market-data-stack';
import { MarketDataContextProps } from '../lib/bleafsi-market-data-context-props';

const app = new cdk.App();

// ----------------------- Environment variables for stack ------------------------------
// Default enviroment
const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? '111111111111',
  region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
};

const appProps: MarketDataContextProps = {
  pjPrefix: 'BLEA-FSI',
  envName: 'test',
  vpcCidr: '10.100.0.0/16',
  region: procEnv.region,
  account: procEnv.account,
  notifyEmail: 'exsample@exsample.com',
};

let marketDataApp: GuestMarketDataStack;

describe(`${appProps.pjPrefix} snapshot check`, () => {
  test('market data sample Stacks', () => {
    marketDataApp = new GuestMarketDataStack(app, `${appProps.pjPrefix}-market-data`, {
      ...appProps,
      env: {
        account: procEnv.account,
        region: procEnv.region,
      },
    });

    // test with snapshot
    expect(Template.fromStack(marketDataApp)).toMatchSnapshot();
  });
});

describe(`${appProps.pjPrefix} cdk-nag AwsSolutions Pack: marketDataApp`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Vpc/FlowLogBucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'It is a log bucket.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Handler-Container-Image/sample_composer-project/Role/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Handler-Container-Image/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Handler-Container-Image/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Handler-App/EcsServiceTaskRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'App can read,write variety of streams' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Handler-App/EcsTaskExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'Target repo are narrowed to Specified account and region' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Composer-Container-Image/sample_composer-project/Role/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Policies are managed by L2 construct and target resources are properly controlled',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Composer-Container-Image/sample_composer-project/Role/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Policies are managed by L2 construct and target resources are properly controlled',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Composer-Container-Image/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Policies are managed by L2 construct and resouce target is only to log',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Composer-Container-Image/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'This lambda is managed by aws_codebuild and only used for deploy image',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Composer-App/EcsServiceTaskRole/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Target stream are properly narrowed',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-Container-Image/sample_handler-project/Role/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Default policy is managed by aws_codebuild construct and only used for build image',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-Container-Image/sample_handler-project/Role/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Default policy is managed by aws_codebuild construct and only used for build image',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-Container-Image/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'This role is managed by custom_resources and only used for build',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-Container-Image/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [
        {
          id: 'AwsSolutions-L1',
          reason: 'This role is managed by custom_resources and only used for build',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-App/containerAppSampleBase/EcsServiceTaskRole/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'App can read,write variety of streams',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-App/SgAlb/Resource',
      [
        {
          id: 'AwsSolutions-EC23',
          reason: 'This is for just sample app',
        },
      ],
    );

    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-App/alb-log-bucket/Resource',
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'This is log bucket',
        },
      ],
    );

    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Composer-App/EcsTaskExecutionRole/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'target resource on ecr:GetAuthorizationToken is always *',
        },
      ],
    );

    NagSuppressions.addResourceSuppressionsByPath(
      marketDataApp,
      '/BLEA-FSI-market-data/BLEA-FSI-Distributor-App/containerAppSampleBase/EcsTaskExecutionRole/DefaultPolicy/Resource',
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'target resource on ecr:GetAuthorizationToken is always *',
        },
      ],
    );

    cdk.Aspects.of(marketDataApp).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(marketDataApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + marketDataApp.stackName);
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
