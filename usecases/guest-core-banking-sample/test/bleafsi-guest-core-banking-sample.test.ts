import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { CoreBankingPrimaryStack } from '../lib/primary/bleafsi-core-banking-primary-stack';
import { CoreBankingSecondaryStack } from '../lib/secondary/bleafsi-core-banking-secondary-stack';
import { PjPrefix, StackParameter, SampleMultiRegionAppParameter, SampleEcsAppParameter } from '../bin/parameter';

const app = new cdk.App();

// ----------------------- Environment variables for stack ------------------------------
// Default enviroment
const procEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? '111111111111',
  primary: {
    region: 'ap-northeast-1',
    regionCidr: '10.100.0.0/16',
    vpcCidr: '10.100.0.0/20',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    regionCidr: '10.101.0.0/16',
    vpcCidr: '10.101.0.0/20',
    tgwAsn: 64513,
  },
};

const appProps: StackParameter = {
  envName: 'test',
  notifyEmail: 'exsample@exsample.com',
  dbUser: 'dbadmin',
  primary: procEnv.primary,
  secondary: procEnv.secondary,
  hostedZoneName: 'example.com',
};

//ECRサンプルアプリケーションはデプロイする状態でテストする
SampleEcsAppParameter.deploy = true;

//マルチリージョンサンプルアプリケーションはデプロイする状態でテストする
SampleMultiRegionAppParameter.deploy = true;

let primaryApp: CoreBankingPrimaryStack;
let secondaryApp: CoreBankingSecondaryStack;

describe(`${PjPrefix} snapshot check`, () => {
  test('Core banking sample Stacks', () => {
    primaryApp = new CoreBankingPrimaryStack(app, `${PjPrefix}-primary`, {
      ...appProps,
      env: {
        account: procEnv.account,
        region: procEnv.primary.region,
      },
      crossRegionReferences: true,
    });
    secondaryApp = new CoreBankingSecondaryStack(app, `${PjPrefix}-secondary`, {
      ...appProps,
      env: {
        account: procEnv.account,
        region: procEnv.secondary.region,
      },
      crossRegionReferences: true,
      auroraSecretName: primaryApp.PrimaryDB.secret.secretName,
      dynamoDbTableName: primaryApp.dynamoDb.tableName,
      tgwRouteTableId: primaryApp.tgwRouteTableId,
    });

    // test with snapshot
    expect(Template.fromStack(primaryApp)).toMatchSnapshot();
    expect(Template.fromStack(secondaryApp)).toMatchSnapshot();
  });
});

describe(`${PjPrefix} cdk-nag AwsSolutions Pack: primaryApp`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/MonitorAlarm/Topic/Resource',
      [{ id: 'AwsSolutions-SNS2', reason: 'SNS encryption is an option.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/ContainerImage/sample-ecs-app-project/Role/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/GetDefaultRouteTableId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/ContainerImage/sample-ecs-app-project/Resource',
      [{ id: 'AwsSolutions-CB4', reason: 'It is a sample build project.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/ECSApp/containerAppSampleBase/SgAlb/Resource',
      [{ id: 'AwsSolutions-EC23', reason: 'It is configured when using.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/ECSApp/containerAppSampleBase/alb-log-bucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'It is a log bucket.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/ECSApp/containerAppSampleBase/EcsTaskExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'Target repo are narrowed to specified account and region.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/ECSApp/containerAppSampleBase/EcsTask/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'Not secrets value, just a environment values.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS6', reason: 'It is not used for performance considerations.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS10', reason: 'This sample must be easy to remove.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/Nlb/NlbOnlyForTest/Resource',
      [{ id: 'AwsSolutions-ELB2', reason: 'this stack is used for checking the operation' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/UpsertSlrCustomResourceHandler8f7be66a3315474baea16ceca43d27c3/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/UpsertSlrCustomResourceHandler8f7be66a3315474baea16ceca43d27c3/ServiceRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );

    ///// MultiRegion sample App
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Alb/Resource',
      [{ id: 'AwsSolutions-ELB2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Alb/SecurityGroup/Resource',
      [{ id: 'AwsSolutions-EC23', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Balance/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Count/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Transaction/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Balance/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Count/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Transaction/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/Transaction/Task/TaskRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/TransactionWorker/Task/TaskRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/TransactionWorker/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleMultiRegionApp/TransactionWorker/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleAppClient/Instance/Resource/Resource',
      [{ id: 'AwsSolutions-EC28', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleAppClient/Bucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleAppClient/Instance/Resource/InstanceRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/SampleAppClient/Instance/Resource/Resource',
      [{ id: 'AwsSolutions-EC29', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/ServiceRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEAFSI-CoreBanking-primary/DBAuroraPg/AuroraCluster/Secret/Resource',
      [
        {
          id: 'AwsSolutions-SMG4',
          reason: 'for convenience of sample application. key rotataion is not enabled',
        },
      ],
    );

    cdk.Aspects.of(primaryApp).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(primaryApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + primaryApp.stackName);
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

describe(`${PjPrefix} cdk-nag AwsSolutions Pack: secondaryApp`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/MonitorAlarm/Topic/Resource',
      [{ id: 'AwsSolutions-SNS2', reason: 'SNS encryption is an option.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/Vpc/createTgwPeeringAttachment/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/AssociateVpcWithHostedZone/Route53AssociateVpc/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/AssociateVpcWithHostedZone/Route53AssociateVpc/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/AssociateVpcWithHostedZone/Route53AssociateVpc/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/GetDefaultRouteTableId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/ECSApp/containerAppSampleBase/SgAlb/Resource',
      [{ id: 'AwsSolutions-EC23', reason: 'It is configured when using.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/ECSApp/containerAppSampleBase/alb-log-bucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'It is a log bucket.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/ECSApp/containerAppSampleBase/EcsTaskExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'Target repo are narrowed to specified account and region.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/ECSApp/containerAppSampleBase/EcsTask/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'Not secrets value, just a environment values.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/DBAuroraPg/AuroraCluster/Secret/Resource',
      [
        {
          id: 'AwsSolutions-SMG4',
          reason:
            'It is difficult to implement the rotation because Serverless Application Repository is not supported in ap-northeast-3.',
        },
      ],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS6', reason: 'It is not used for performance considerations.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS10', reason: 'This sample must be easy to remove.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );

    ///// MultiRegion Sample App
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Alb/Resource',
      [{ id: 'AwsSolutions-ELB2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Alb/SecurityGroup/Resource',
      [{ id: 'AwsSolutions-EC23', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Balance/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Count/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Transaction/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Balance/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Count/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Transaction/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/Transaction/Task/TaskRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/TransactionWorker/Task/TaskRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/TransactionWorker/Task/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'This resource is a sample application.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEAFSI-CoreBanking-secondary/SampleMultiRegionApp/TransactionWorker/Task/ExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'This resource is a sample application.' }],
    );

    cdk.Aspects.of(secondaryApp).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(secondaryApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + secondaryApp.stackName);
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
