#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CustomerChannelPrimaryStack } from '../lib/bleafsi-customer-channel-primary-stack';
import { CustomerChannelSecondaryStack } from '../lib/bleafsi-customer-channel-secondary-stack';
import { CustomerChannelTertiaryStack } from '../lib/bleafsi-customer-channel-tertiary-stack';
import { AppParameter, PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';

function addEnvironmentTag(appParam: AppParameter, stack: cdk.Stack) {
  const ENV_TAG_NAME = 'Environment';
  cdk.Tags.of(stack).add(ENV_TAG_NAME, appParam.envName);
}

export interface CustomerChannelStacks {
  readonly primaryStack: CustomerChannelPrimaryStack;
  readonly secondaryStack?: CustomerChannelSecondaryStack;
  readonly tertiaryStack?: CustomerChannelTertiaryStack;
}

export function createStacks(app: cdk.App, pjPrefix: string, appParam: AppParameter): CustomerChannelStacks {
  let tertiaryStack: CustomerChannelTertiaryStack | undefined;
  if (appParam.tertiaryRegion) {
    tertiaryStack = new CustomerChannelTertiaryStack(app, `${pjPrefix}-${appParam.envName}-Tertiary`, {
      env: { account: appParam.account, region: appParam.tertiaryRegion.region },
    });
    addEnvironmentTag(appParam, tertiaryStack);
  }

  const primaryStack = new CustomerChannelPrimaryStack(app, `${pjPrefix}-${appParam.envName}-Primary`, {
    description: 'BLEA for FSI Customer Channel (uksb-1tupboc63) (tag:guest-customer-channel-sample)',
    env: { account: appParam.account, region: appParam.primaryRegion.region },
    connectInstance: appParam.primaryRegion.connectInstance,
    tertiaryStack,
  });
  addEnvironmentTag(appParam, primaryStack);

  let secondaryStack: CustomerChannelSecondaryStack | undefined;
  if (appParam.secondaryRegion) {
    if (!tertiaryStack) {
      throw Error("The secondary region's stack depends on the existence of the tertiary region's stack.");
    }
    secondaryStack = new CustomerChannelSecondaryStack(app, `${pjPrefix}-${appParam.envName}-Secondary`, {
      env: { account: appParam.account, region: appParam.secondaryRegion.region },
      connectInstance: appParam.secondaryRegion.connectInstance,
      tertiaryStack,
    });
    secondaryStack.addDependency(tertiaryStack);
    addEnvironmentTag(appParam, secondaryStack);
  }

  return { primaryStack, secondaryStack, tertiaryStack };
}

const app = new cdk.App();
[DevParameter].forEach((appParam) => createStacks(app, PjPrefix, appParam));
//[DevParameter, StageParameter, ProdParameter].forEach((appParam) => createStacks(app, PjPrefix, appParam));
