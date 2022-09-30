import * as cdk from 'aws-cdk-lib';
import { Annotations, Match, Template } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { ProcessEnv } from '../bin/bleafsi-guest-openapi-fapi-sample';
import {
  OpenApiFapiPrimaryStack,
  OpenApiFapiStackContextProps,
} from '../lib/primary/bleafsi-guest-openapi-fapi-primary-stack';
import { KeycloakPrimaryProps, KeycloakPrimaryStack } from '../lib/primary/bleafsi-keycloak-primary-stack';
import { KeycloakProps, KeycloakVersion } from '../lib/shared/bleafsi-keycloak';
import { VpcStackProps, VpcStack } from '../lib/shared/bleafsi-vpc-stack';

const app = new cdk.App();

// ----------------------- Environment variables for stack ------------------------------
// Default enviroment
const procEnv: ProcessEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? '111111111111',
  keycloakContainerImageName: 'jboss/keycloak',
  keycloakContainerVersionTag: '16.1.1',
  primary: {
    region: 'ap-northeast-1',
    vpcCidr: '10.110.0.0/16',
    tgwAsn: 64512,
  },
  secondary: {
    region: 'ap-northeast-3',
    vpcCidr: '10.111.0.0/16',
    tgwAsn: 64513,
  },
};

const openApiFapiStackProps: OpenApiFapiStackContextProps = {
  pjPrefix: 'BLEA-FSI-OpenApi',
  envKey: 'test',
  dbUser: 'dbadmin',
  keycloakContainerImageName: 'jboss/keycloak',
  keycloakVersion: KeycloakVersion.V16_1_1,
  primary: procEnv.primary,
  secondary: procEnv.secondary,
  env: {
    region: 'ap-northeast-1',
  },
};

let openApiFapiPrimaryStack: OpenApiFapiPrimaryStack;
let keycloakPrimaryStack: KeycloakPrimaryStack;
let vpcStack: VpcStack;

describe(`${openApiFapiStackProps.pjPrefix} snapshot check`, () => {
  test('OpenAPI FAPI sample Stacks', () => {
    openApiFapiPrimaryStack = new OpenApiFapiPrimaryStack(
      app,
      `${openApiFapiStackProps.pjPrefix}-openapi-fapi-primary`,
      {
        env: {
          region: 'ap-northeast-1',
        },
      },
      openApiFapiStackProps,
    );

    const keycloakPrimaryStackProps: KeycloakPrimaryProps = {
      myVpc: openApiFapiPrimaryStack.vpc,
      dbName: 'keycloak',
      dbUser: openApiFapiStackProps.dbUser,
      keycloakContainerImageName: openApiFapiStackProps.keycloakContainerImageName,
      keycloakVersion: KeycloakVersion.V16_1_1,
      env: {
        region: 'ap-northeast-1',
      },
    };

    const vpcStackProps: VpcStackProps = {
      regionEnv: { region: 'ap-northeast-1', tgwAsn: 64512, vpcCidr: '10.110.0.0/16' },
      oppositeRegionEnv: { region: 'ap-northeast-3', tgwAsn: 64513, vpcCidr: '10.111.0.0/16' },
    };

    vpcStack = new VpcStack(
      openApiFapiPrimaryStack,
      `${openApiFapiStackProps.pjPrefix}-openapi-fapi-keycloak-primary`,
      vpcStackProps,
    );

    const keyclockProps: KeycloakProps = {
      keycloakContainerImageName: keycloakPrimaryStackProps.keycloakContainerImageName,
      keycloakVersion: keycloakPrimaryStackProps.keycloakVersion,
    };

    keycloakPrimaryStack = new KeycloakPrimaryStack(
      app,
      `${openApiFapiStackProps.pjPrefix}-openapi-fapi-keycloak-primary`,
      keycloakPrimaryStackProps,
    );

    // test with snapshot
    expect(Template.fromStack(openApiFapiPrimaryStack)).toMatchSnapshot();
    expect(Template.fromStack(keycloakPrimaryStack)).toMatchSnapshot();
  });
});

// cdk-nag test
describe(`${openApiFapiStackProps.pjPrefix} cdk-nag AwsSolutions Pack: openApiPrimaryStack`, () => {
  beforeAll(() => {
    //Suppress
    NagSuppressions.addStackSuppressions(
      openApiFapiPrimaryStack,
      [
        {
          id: 'AwsSolutions-S1',
          reason: 'OK. Not to use an additional S3 bucket for S3 Access Logs. because simplification to this sample.',
        },
      ],
      true,
    );
    cdk.Aspects.of(openApiFapiPrimaryStack).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(openApiFapiPrimaryStack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    try {
      expect(errors).toHaveLength(0);

      console.log('cdk-nag: no errors for stack ' + openApiFapiPrimaryStack.stackName);
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

describe(`${openApiFapiStackProps.pjPrefix} cdk-nag AwsSolutions Pack: keycloakPrimaryStack`, () => {
  beforeAll(() => {
    //Nag Suppressions
    NagSuppressions.addStackSuppressions(keycloakPrimaryStack, [
      {
        id: 'AwsSolutions-S1',
        reason: 'OK. Not to use an additional S3 bucket for S3 Access Logs. because simplification to this sample.',
      },
      { id: 'AwsSolutions-RDS6', reason: 'OK. Not to use IAM Database Authentication, because performance aspects.' },
      { id: 'AwsSolutions-RDS11', reason: 'CAN NOT Avoid. Aurora serverless v1 cannot change the default port 3306.' },
      {
        id: 'AwsSolutions-SMG4',
        reason: "OK. does not need secrets rotations because It's needs additional Lambda functions.",
      },
      { id: 'AwsSolutions-IAM4', reason: 'OK to use AWS automated generation policies.' },
      { id: 'AwsSolutions-IAM5', reason: 'OK to use AWS automated generation policies.' },
      { id: 'AwsSolutions-ECS2', reason: 'Not secrets value, just a environment values.' },
      { id: 'AwsSolutions-EC23', reason: 'OK. Security group is open to internet for its responsibility' },
      { id: 'AwsSolutions-ELB2', reason: 'OK. NLB does not write any access log under TCP listner configuration.' },
      { id: 'CdkNagValidationFailure', reason: 'suppress warnings.' },
    ]);

    cdk.Aspects.of(keycloakPrimaryStack).add(new AwsSolutionsChecks());
  });

  test('No unsurpressed Errors', () => {
    const errors = Annotations.fromStack(keycloakPrimaryStack).findError(
      '*',
      Match.stringLikeRegexp('AwsSolutions-.*'),
    );
    try {
      expect(errors).toHaveLength(0);
      console.log('cdk-nag: no errors for stack ' + keycloakPrimaryStack.stackName);
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
