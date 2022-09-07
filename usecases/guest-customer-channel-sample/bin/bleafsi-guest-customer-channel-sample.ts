#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CustomerChannelPrimaryStack } from '../lib/bleafsi-customer-channel-primary-stack';
import { CustomerChannelSecondaryStack } from '../lib/bleafsi-customer-channel-secondary-stack';
import { CustomerChannelTertiaryStack } from '../lib/bleafsi-customer-channel-tertiary-stack';
import { assertAppEnvConfig } from '../lib/bleafsi-customer-channel-config';

const app = new cdk.App();

// ----------------------- Load context variables ------------------------------
// This context need to be specified in args
const argContext = 'environment';
const envKey = app.node.tryGetContext(argContext);
if (envKey == undefined) {
  throw new Error(`Please specify environment with context option. (e.g., cdk deploy -c ${argContext}=dev)`);
}

const envVals = app.node.tryGetContext(envKey);
if (envVals == undefined) {
  throw new Error('Invalid environment.');
}

const pjPrefix = app.node.tryGetContext('pjPrefix');
const appEnv = assertAppEnvConfig('AppEnvConfig', envVals);

const tertiaryStack = appEnv.tertiaryRegion
  ? new CustomerChannelTertiaryStack(app, `${pjPrefix}-CustomerChannelTertiaryStack`, {
      env: { account: appEnv.account, region: appEnv.tertiaryRegion.region },
    })
  : undefined;

new CustomerChannelPrimaryStack(app, `${pjPrefix}-CustomerChannelPrimaryStack`, {
  env: { account: appEnv.account, region: appEnv.primaryRegion.region },
  connectInstance: appEnv.primaryRegion.connectInstance,
  tertiaryStack,
});
if (appEnv.secondaryRegion) {
  if (!tertiaryStack) {
    throw Error("The secondary region's stack depends on the existence of the tertiary region's stack.");
  }
  const secondaryStack = new CustomerChannelSecondaryStack(app, `${pjPrefix}-CustomerChannelSecondaryStack`, {
    env: { account: appEnv.account, region: appEnv.secondaryRegion.region },
    connectInstance: appEnv.secondaryRegion.connectInstance,
    tertiaryStack,
  });
  secondaryStack.addDependency(tertiaryStack);
}
