import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OpenApiBaseContextProps } from '../lib/shared/bleafsi-types';
import { SampleOpenApiStack } from '../lib/bleafsi-openapi-base-sample-stack';
import { SampleWafApigwStack } from '../lib/bleafsi-waf-apigw-sample-stack';
import { SampleCfStack } from '../lib/bleafsi-cloudfront-sample-stack';

const app = new cdk.App();
const pjPrefix = app.node.tryGetContext('pjPrefix'); //Load project prefix

// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined)
  throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=dev`);

const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) throw new Error('Invalid environment.');

// ----------------------- Environment variables for stack ------------------------------
// Default enviroment
const procEnvDefault = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Define account id and region from context.
// If "env" isn't defined on the environment variable in context, use account and region specified by "--profile".
function getProcEnv() {
  if (envVals['env'] && envVals['env']['account'] && envVals['env']['region']) {
    return { account: envVals['env']['account'], region: envVals['env']['region'] };
  } else {
    return procEnvDefault;
  }
}

const appProps: OpenApiBaseContextProps = {
  customdomainName: envVals['customdomainName'],
  alterdomainName: envVals['alterdomainName'],
  certIdarnApigw: envVals['certIdarnApigw'],
  certIdarnCf: envVals['certIdarnCf'],
  env: getProcEnv(),
};

const apiStack = new SampleOpenApiStack(app, `${pjPrefix}-SampleOpenApiStack`, appProps);
new SampleWafApigwStack(app, `${pjPrefix}-Wafv2ApigwStack`, {
  restApiId: apiStack.sample_api.restApiId,
  env: getProcEnv(),
});
new SampleCfStack(app, `${pjPrefix}-SampleCfStack`, appProps);
