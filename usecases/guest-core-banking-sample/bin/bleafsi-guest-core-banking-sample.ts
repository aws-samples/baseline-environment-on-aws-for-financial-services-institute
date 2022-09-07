import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CoreBankingContextProps, RegionEnv } from '../lib/shared/bleafsi-types';
import { AcceptTgwPeeringStack } from '../lib/bleafsi-accept-tgw-peering-stack';
import { NlbOnlyForTestStack } from '../lib/bleafsi-nlb-only-for-test-stack';
import { CoreBankingPrimaryStack } from '../lib/primary/bleafsi-core-banking-primary-stack';
import { CoreBankingSecondaryStack } from '../lib/secondary/bleafsi-core-banking-secondary-stack';

const app = new cdk.App();

// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);

const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

// ----------------------- Environment variables for stack ------------------------------
export type ProcEnv = {
  account: string;
  primary: RegionEnv;
  secondary: RegionEnv;
};

// Define account id and region from context.
// If "env" isn't defined on the environment variable in context, use account and region specified by "--profile".
function getProcEnv(): ProcEnv {
  if (envVals['primaryRegion'] === undefined) throw new Error('Please set "primaryRegion" in cdk.json');
  if (envVals['secondaryRegion'] === undefined) throw new Error('Please set "secondaryRegion" in cdk.json');
  if (envKey != 'dev' && envVals['env'] === undefined && process.env.CDK_DEFAULT_ACCOUNT === undefined)
    //no check on dev environment
    throw new Error('Invalid environment.');
  return {
    account: envVals['env']?.['account'] ?? process.env.CDK_DEFAULT_ACCOUNT,
    primary: {
      region: envVals['primaryRegion']['region'] ?? process.env.CDK_DEFAULT_REGION,
      vpcCidr: envVals['primaryRegion']['vpcCidr'] ?? '10.100.0.0/16',
      tgwAsn: envVals['primaryRegion']['tgwAsn'] ?? 64512,
    },
    secondary: {
      region: envVals['secondaryRegion']['region'] ?? 'ap-northeast-3',
      vpcCidr: envVals['secondaryRegion']['vpcCidr'] ?? '10.101.0.0/16',
      tgwAsn: envVals['secondaryRegion']['tgwAsn'] ?? 64513,
    },
  };
}

const procEnv = getProcEnv();
const appProps: CoreBankingContextProps = {
  pjPrefix: app.node.tryGetContext('pjPrefix'),
  envName: envKey as string,
  notifyEmail: envVals['monitoringNotifyEmail'],
  dbUser: envVals['dbUser'],
  primary: procEnv.primary,
  secondary: procEnv.secondary,
};

// ----------------------- Guest System Stacks ------------------------------
// Primary Region
const primaryApp = new CoreBankingPrimaryStack(app, `${appProps.pjPrefix}-core-banking-primary`, {
  ...appProps,
  env: {
    account: procEnv.account,
    region: procEnv.primary.region,
  },
});

// Secondary Region
const secondaryApp = new CoreBankingSecondaryStack(app, `${appProps.pjPrefix}-core-banking-secondary`, {
  ...appProps,
  env: {
    account: procEnv.account,
    region: procEnv.secondary.region,
  },
});

// Accept Transit Gateway Peering Attachment
const acceptTgwPeering = new AcceptTgwPeeringStack(app, `${appProps.pjPrefix}-core-banking-accept-tgw-peering`, {
  pjPrefix: appProps.pjPrefix,
  envName: appProps.envName,
  env: {
    account: procEnv.account,
    region: procEnv.primary.region,
  },
});

// Ensure secondary region app and stacks will be de deploied after primary region
secondaryApp.node.addDependency(primaryApp);
// Aurora Global Cluster in Primary Region must be created before secondary
secondaryApp.SecondaryDB.addDependency(primaryApp.PrimaryDB);

acceptTgwPeering.node.addDependency(secondaryApp);

// This NLB is provided to check if the sample application is running from the Internet.
// Do not use it in production.
const nlbOnlyForTestApp = new NlbOnlyForTestStack(app, `${appProps.pjPrefix}-core-banking-nlb-only-for-test`, {
  pjPrefix: appProps.pjPrefix,
  myVpc: primaryApp.vpc,
  targetAlb: primaryApp.alb,
  env: {
    account: procEnv.account,
    region: procEnv.primary.region,
  },
});
nlbOnlyForTestApp.addDependency(primaryApp);

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'core-banking';
cdk.Tags.of(app).add(envTagName, envTagVal);
cdk.Tags.of(app).add(envTagName, envTagVal);
