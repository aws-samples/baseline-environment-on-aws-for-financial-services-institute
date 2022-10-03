import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { AcceptTgwPeeringStack } from '../lib/bleafsi-accept-tgw-peering-stack';
import { ProcEnv } from '../bin/bleafsi-guest-core-banking-sample';
import { NlbOnlyForTestStack } from '../lib/bleafsi-nlb-only-for-test-stack';
import { CoreBankingPrimaryStack } from '../lib/primary/bleafsi-core-banking-primary-stack';
import { CoreBankingSecondaryStack } from '../lib/secondary/bleafsi-core-banking-secondary-stack';
import { CoreBankingContextProps } from '../lib/shared/bleafsi-types';

const app = new cdk.App();

// ----------------------- Environment variables for stack ------------------------------
// Default enviroment
const procEnv: ProcEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? '111111111111',
  primary: {
    region: 'ap-northeast-1',
    vpcCidr: '10.100.0.0/16',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    vpcCidr: '10.101.0.0/16',
    tgwAsn: 64513,
  },
};

const appProps: CoreBankingContextProps = {
  pjPrefix: 'BLEA-FSI',
  envName: 'test',
  notifyEmail: 'exsample@exsample.com',
  dbUser: 'dbadmin',
  primary: procEnv.primary,
  secondary: procEnv.secondary,
};

let primaryApp: CoreBankingPrimaryStack;
let secondaryApp: CoreBankingSecondaryStack;
let acceptTgwPeering: AcceptTgwPeeringStack;
let nlbOnlyForTestApp: NlbOnlyForTestStack;

describe(`${appProps.pjPrefix} snapshot check`, () => {
  test('Core banking sample Stacks', () => {
    primaryApp = new CoreBankingPrimaryStack(app, `${appProps.pjPrefix}-core-banking-primary`, {
      ...appProps,
      env: {
        account: procEnv.account,
        region: procEnv.primary.region,
      },
    });
    secondaryApp = new CoreBankingSecondaryStack(app, `${appProps.pjPrefix}-core-banking-secondary`, {
      ...appProps,
      env: {
        account: procEnv.account,
        region: procEnv.secondary.region,
      },
    });
    acceptTgwPeering = new AcceptTgwPeeringStack(app, `${appProps.pjPrefix}-core-banking-accept-tgw-peering`, {
      pjPrefix: appProps.pjPrefix,
      envName: appProps.envName,
      env: {
        account: procEnv.account,
        region: procEnv.primary.region,
      },
    });
    nlbOnlyForTestApp = new NlbOnlyForTestStack(app, `${appProps.pjPrefix}-core-banking-nlb-only-for-test`, {
      pjPrefix: appProps.pjPrefix,
      myVpc: primaryApp.vpc,
      targetAlb: primaryApp.alb,
      env: {
        account: procEnv.account,
        region: procEnv.primary.region,
      },
    });

    // test with snapshot
    expect(Template.fromStack(primaryApp)).toMatchSnapshot();
    expect(Template.fromStack(secondaryApp)).toMatchSnapshot();
    expect(Template.fromStack(acceptTgwPeering)).toMatchSnapshot();
    expect(Template.fromStack(nlbOnlyForTestApp)).toMatchSnapshot();
  });
});

describe(`${appProps.pjPrefix} cdk-nag AwsSolutions Pack: primaryApp`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-MonitorAlarm/MonitorAlarmTopic/Resource',
      [{ id: 'AwsSolutions-SNS2', reason: 'SNS encryption is an option.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-Vpc/FlowLogBucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'It is a log bucket.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-Vpc/crossRegionSsmParam-addTgwId/SsmPutParam-TgwPrimaryId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-Vpc/crossRegionSsmParam-addTgwId/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-Vpc/crossRegionSsmParam-addTgwId/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ContainerImage/sample-ecs-app-project/Role/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ContainerImage/sample-ecs-app-project/Resource',
      [{ id: 'AwsSolutions-CB4', reason: 'It is a sample build project.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ContainerImage/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ContainerImage/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/containerAppSampleBase/SgAlb/Resource',
      [{ id: 'AwsSolutions-EC23', reason: 'It is configured when using.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/containerAppSampleBase/alb-log-bucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'It is a log bucket.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/containerAppSampleBase/EcsTaskExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'Target repo are narrowed to specified account and region.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/containerAppSampleBase/EcsTask/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'Not secrets value, just a environment values.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/crossRegionSsmParam/SsmPutParam-EcrAppImageTag/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-ECSApp/crossRegionSsmParam/SsmPutParam-EcrAppRepositoryName/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-PrivateHostedZone/crossRegionSsmParam/SsmPutParam-PrivateHostedZoneId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-PrivateHostedZone/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-PrivateHostedZone/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS6', reason: 'It is not used for performance considerations.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS10', reason: 'This sample must be easy to remove.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-DBAuroraPg/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      primaryApp,
      '/BLEA-FSI-core-banking-primary/BLEA-FSI-DBAuroraPg/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
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

describe(`${appProps.pjPrefix} cdk-nag AwsSolutions Pack: secondaryApp`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-MonitorAlarm/MonitorAlarmTopic/Resource',
      [{ id: 'AwsSolutions-SNS2', reason: 'SNS encryption is an option.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AppKey/crossRegionSsmParam/SsmPutParam-KmsSecondaryAppKeyArn/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AppKey/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AppKey/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/FlowLogBucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'It is a log bucket.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/crossRegionSsmParam-peerTgwId/SsmGetParam-TgwPrimaryId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/crossRegionSsmParam-peerTgwId/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/crossRegionSsmParam-peerTgwId/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/createTgwPeeringAttachment/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/crossRegionSsmParam-peeringAttachmentId/SsmPutParam-TgwPeeringAttachmentId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/crossRegionSsmParam-peeringAttachmentId/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-Vpc/crossRegionSsmParam-peeringAttachmentId/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/crossRegionSsmParam/SsmGetParam-PrivateHostedZoneId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/Route53AssociateVpc/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/Route53AssociateVpc/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/Route53AssociateVpc/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-AssociateVpcWithHostedZone/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/crossRegionSsmParam/SsmGetParam-EcrAppImageTag/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/crossRegionSsmParam/SsmGetParam-EcrAppRepositoryName/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/containerAppSampleBase/SgAlb/Resource',
      [{ id: 'AwsSolutions-EC23', reason: 'It is configured when using.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/containerAppSampleBase/alb-log-bucket/Resource',
      [{ id: 'AwsSolutions-S1', reason: 'It is a log bucket.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/containerAppSampleBase/EcsTaskExecutionRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'Target repo are narrowed to specified account and region.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-ECSApp/containerAppSampleBase/EcsTask/Resource',
      [{ id: 'AwsSolutions-ECS2', reason: 'Not secrets value, just a environment values.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-DBAuroraPg/AuroraCluster/Secret/Resource',
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
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS6', reason: 'It is not used for performance considerations.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-DBAuroraPg/AuroraCluster/Resource',
      [{ id: 'AwsSolutions-RDS10', reason: 'This sample must be easy to remove.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-DBAuroraPg/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      secondaryApp,
      '/BLEA-FSI-core-banking-secondary/BLEA-FSI-DBAuroraPg/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole/DefaultPolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
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

describe(`${appProps.pjPrefix} cdk-nag AwsSolutions Pack: acceptTgwPeering`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      acceptTgwPeering,
      '/BLEA-FSI-core-banking-accept-tgw-peering/BLEA-FSI-crossRegionSsmParam/SsmGetParam-TgwPeeringAttachmentId/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      acceptTgwPeering,
      '/BLEA-FSI-core-banking-accept-tgw-peering/BLEA-FSI-crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      acceptTgwPeering,
      '/BLEA-FSI-core-banking-accept-tgw-peering/BLEA-FSI-crossRegionSsmParam/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      acceptTgwPeering,
      '/BLEA-FSI-core-banking-accept-tgw-peering/BLEA-FSI-AcceptTgwPeeringAttachment/CustomResourcePolicy/Resource',
      [{ id: 'AwsSolutions-IAM5', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      acceptTgwPeering,
      '/BLEA-FSI-core-banking-accept-tgw-peering/AWS679f53fac002430cb0da5b7982bd2287/ServiceRole/Resource',
      [{ id: 'AwsSolutions-IAM4', reason: 'It is used only when deploying.' }],
    );
    NagSuppressions.addResourceSuppressionsByPath(
      acceptTgwPeering,
      '/BLEA-FSI-core-banking-accept-tgw-peering/AWS679f53fac002430cb0da5b7982bd2287/Resource',
      [{ id: 'AwsSolutions-L1', reason: 'It is used only when deploying.' }],
    );
    cdk.Aspects.of(acceptTgwPeering).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(acceptTgwPeering).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + acceptTgwPeering.stackName);
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

describe(`${appProps.pjPrefix} cdk-nag AwsSolutions Pack: nlbOnlyForTestApp`, () => {
  beforeAll(() => {
    NagSuppressions.addResourceSuppressionsByPath(
      nlbOnlyForTestApp,
      '/BLEA-FSI-core-banking-nlb-only-for-test/BLEA-FSI-NlbOnlyForTest/Resource',
      [{ id: 'AwsSolutions-ELB2', reason: 'this stack is used for checking the operation' }],
    );
    cdk.Aspects.of(nlbOnlyForTestApp).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(nlbOnlyForTestApp).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + nlbOnlyForTestApp.stackName);
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
