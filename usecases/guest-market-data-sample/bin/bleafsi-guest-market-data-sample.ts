import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MarketDataContextProps } from './../lib/bleafsi-market-data-context-props';
import { GuestMarketDataStack } from '../lib/bleafsi-guest-market-data-stack';

const app = new cdk.App();

// -----------------------コンテキストをロード------------------------------
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);

const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

// アカウントID とリージョン
// envの指定がない場合、デフォルト / "--profile" で指定されたプロファイルを使用
function getProcEnv(): { account: string; region: string } {
  if (envKey != 'dev' && envVals['env'] === undefined && process.env.CDK_DEFAULT_ACCOUNT === undefined)
    //no check on dev environment
    throw new Error('Invalid environment.');
  if (envKey != 'dev' && envVals['env'] === undefined && process.env.CDK_DEFAULT_REGION === undefined)
    throw new Error('Invalid environment.');
  return {
    account: envVals['env']?.['account'] ?? process.env.CDK_DEFAULT_ACCOUNT,
    region: envVals['env']?.['region'] ?? process.env.CDK_DEFAULT_REGION,
  };
}

const appProps: MarketDataContextProps = {
  pjPrefix: app.node.tryGetContext('pjPrefix'),
  envName: envKey as string,
  vpcCidr: envVals['vpcCidr'],
  account: getProcEnv().account,
  region: getProcEnv().region,
  notifyEmail: envVals['securityNotifyEmail'],
};

// ----------------------- Guest System Stacks ------------------------------
new GuestMarketDataStack(app, `${appProps.pjPrefix}-martket-data`, {
  ...appProps,
  env: {
    account: getProcEnv().account,
    region: getProcEnv().region,
  },
});

// --------------------------------- Tagging  -------------------------------------
// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'market-data';
cdk.Tags.of(app).add(envTagName, envTagVal);
cdk.Tags.of(app).add(envTagName, envTagVal);
