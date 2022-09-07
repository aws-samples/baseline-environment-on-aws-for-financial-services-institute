import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IamStack } from '../../base-ct-guest/lib/bleafsi-iam-stack';
import { SecurityAlarmStack } from '../lib/bleafsi-security-alarm-stack';
import { ConfigCtGuardrailStack } from '../lib/bleafsi-config-ct-guardrail-stack';

/*
 * ゲストアカウントの大阪リージョンにガバナンスベースをデプロイ
 */

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
  } else if (envVals['env'] && envVals['env']['region']) {
    return { account: process.env.CDK_DEFAULT_ACCOUNT, region: envVals['env']['region'] };
  } else {
    return procEnvDefault;
  }
}

// ----------------------- Guest Account Base Stacks ------------------------------
new IamStack(app, `${pjPrefix}-Iam`, { env: getProcEnv() });

//For apply conformance pack config rules instead of CT guardrails
new ConfigCtGuardrailStack(app, `${pjPrefix}-ConfigCtGuardrail`, { env: getProcEnv() });

// Security Alarms
// !!! Need to setup SecurityHub, GuardDuty manually on Organizations Management account
// AWS Config and CloudTrail are set up by ControlTower

new SecurityAlarmStack(app, `${pjPrefix}-SecurityAlarm`, {
  notifyEmail: envVals['securityNotifyEmail'],
  env: getProcEnv(),
});

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'audit';
cdk.Tags.of(app).add(envTagName, envTagVal);
