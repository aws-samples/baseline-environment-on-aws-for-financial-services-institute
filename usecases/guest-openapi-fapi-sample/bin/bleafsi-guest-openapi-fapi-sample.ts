import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {
  OpenApiFapiPrimaryStack,
  RegionEnv,
  OpenApiFapiStackContextProps,
} from '../lib/primary/bleafsi-guest-openapi-fapi-primary-stack';
import { KeycloakPrimaryStack } from '../lib/primary/bleafsi-keycloak-primary-stack';
import { KeycloakVersion } from '../lib/shared/bleafsi-keycloak';

const app = new cdk.App();
// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined) {
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);
}

const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) {
  throw new Error('Invalid environment.');
}

// ----------------------- Environment variables for stack ------------------------------
export type ProcessEnv = {
  account: string;
  keycloakContainerImageName: string;
  keycloakContainerVersionTag: string;
  primary: RegionEnv;
  secondary: RegionEnv;
};

// Define account id and region from context.
// If "env" isn't defined on the environment variable in context, use account and region specified by "--profile".
function getProcessEnv(): ProcessEnv {
  //Validation
  if (envVals['primaryRegion'] === undefined) {
    throw new Error('Please set "primaryRegion" in cdk.json');
  } else if (envVals['secondaryRegion'] === undefined) {
    throw new Error('Please set "secondaryRegion" in cdk.json');
  } else if (envKey != 'dev' && envVals['env'] === undefined && process.env.CDK_DEFAULT_ACCOUNT === undefined) {
    //no check on dev environment
    throw new Error('Invalid environment.');
  }

  //最終的なプロセス設定(cdk.json や cdkコマンドコンテキスト設定(-c key=val) のどちらにも値が無い場合のデフォルト値をセット)
  return {
    account: envVals['env']?.['account'] ?? process.env.CDK_DEFAULT_ACCOUNT,
    keycloakContainerImageName: envVals['keycloakContainerImageName'] ?? 'jboss/keycloak',
    keycloakContainerVersionTag: envVals['keycloakContainerVersionTag'] ?? '16.1.1',
    primary: {
      region: envVals['primaryRegion']['region'] ?? process.env.CDK_DEFAULT_REGION,
      vpcCidr: envVals['primaryRegion']['vpcCidr'] ?? '10.110.0.0/16',
      tgwAsn: envVals['primaryRegion']['tgwAsn'] ?? 64512,
    },
    secondary: {
      region: envVals['secondaryRegion']['region'] ?? 'ap-northeast-3',
      vpcCidr: envVals['secondaryRegion']['vpcCidr'] ?? '10.111.0.0/16',
      tgwAsn: envVals['secondaryRegion']['tgwAsn'] ?? 64513,
    },
  };
}

const procEnv = getProcessEnv();

const appContext: OpenApiFapiStackContextProps = {
  pjPrefix: 'BLEA-FSI',
  envKey: envKey as string,
  dbUser: envVals['dbUser'],
  keycloakContainerImageName: procEnv.keycloakContainerImageName,
  keycloakVersion: KeycloakVersion.of(procEnv.keycloakContainerVersionTag),
  primary: procEnv.primary,
  secondary: procEnv.secondary,
};

/**
 *
 */
const openApiPrimaryStack = new OpenApiFapiPrimaryStack(
  app,
  `${appContext.pjPrefix}-openapi-fapi-primary`,
  {
    env: {
      account: procEnv.account,
      region: procEnv.primary.region,
    },
  },
  appContext,
);

const keycloakStack = new KeycloakPrimaryStack(app, `${appContext.pjPrefix}-openapi-fapi-keycloak-primary`, {
  env: {
    account: procEnv.account,
    region: procEnv.primary.region,
  },
  myVpc: openApiPrimaryStack.vpc,
  dbName: 'keycloakdb',
  dbUser: appContext.dbUser,
  keycloakContainerImageName: procEnv.keycloakContainerImageName,
  keycloakVersion: appContext.keycloakVersion,
});

keycloakStack.addDependency(openApiPrimaryStack);

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'openapi-fapi';
cdk.Tags.of(app).add(envTagName, envTagVal);

app.synth();
