import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { CustomerChannelPrimaryStack } from '../lib/bleafsi-customer-channel-primary-stack';
import { CustomerChannelSecondaryStack } from '../lib/bleafsi-customer-channel-secondary-stack';
import { CustomerChannelTertiaryStack } from '../lib/bleafsi-customer-channel-tertiary-stack';
import { AppEnvConfig } from '../lib/config';
import { PjPrefix, DevParameter } from '../bin/parameter';
import { CustomerChannelStacks, createStacks } from '../bin/bleafsi-guest-customer-channel-sample';
import { AwsSolutionsChecks } from 'cdk-nag';

function createPrimaryStack(appEnv: AppEnvConfig, app: cdk.App, tertiaryStack: CustomerChannelTertiaryStack) {
  return new CustomerChannelPrimaryStack(app, 'CustomerChannelPrimaryStack', {
    env: { account: appEnv.account, region: appEnv.primaryRegion.region },
    connectInstance: appEnv.primaryRegion.connectInstance,
    tertiaryStack,
  });
}
function createSecondaryStack(appEnv: AppEnvConfig, app: cdk.App, tertiaryStack: CustomerChannelTertiaryStack) {
  if (!appEnv.secondaryRegion || !appEnv.tertiaryRegion) {
    throw Error(`Required regions are missing in appEnv`);
  }
  return new CustomerChannelSecondaryStack(app, 'CustomerChannelSecondaryStack', {
    env: { account: appEnv.account, region: appEnv.secondaryRegion.region },
    connectInstance: appEnv.secondaryRegion.connectInstance,
    tertiaryStack,
  });
}
function createTertiaryStack(appEnv: AppEnvConfig, app: cdk.App) {
  if (!appEnv.tertiaryRegion) {
    throw Error(`Required region is missing in appEnv`);
  }
  return new CustomerChannelTertiaryStack(app, 'CustomerChannelTertiaryStack', {
    env: { account: appEnv.account, region: appEnv.tertiaryRegion.region },
  });
}

function getStackList(stacks: CustomerChannelStacks): cdk.Stack[] {
  return [stacks.primaryStack, stacks.secondaryStack, stacks.tertiaryStack].filter(
    (stack): stack is cdk.Stack => stack != undefined,
  );
}

describe('snapshot check', () => {
  test('Customer channel sample stacks', () => {
    const appParam = DevParameter;
    if (!appParam.secondaryRegion || !appParam.tertiaryRegion) {
      throw Error(`Required regions are missing in DevParameter`);
    }

    const app = new cdk.App();
    const stacks = createStacks(app, PjPrefix, appParam);
    getStackList(stacks).forEach((stack) => {
      expect(Template.fromStack(stack)).toMatchSnapshot();
    });
  });
});

function createPrimaryStackForNagTest(app: cdk.App): cdk.Stack {
  const appEnv = DevParameter;
  const stacks = createStacks(app, PjPrefix, appEnv);
  return stacks.primaryStack;
}
function createSecondaryStackForNagTest(app: cdk.App): cdk.Stack {
  const appEnv = DevParameter;
  const tertiaryStack = createTertiaryStack(appEnv, app);
  return createPrimaryStack(appEnv, app, tertiaryStack);
}
function createTertiaryStackForNagTest(app: cdk.App): cdk.Stack {
  const appEnv = DevParameter;
  return createTertiaryStack(appEnv, app);
}

describe.each([
  ['primary', createPrimaryStackForNagTest],
  ['secondary', createSecondaryStackForNagTest],
  ['tertiary', createTertiaryStackForNagTest],
])('cdk-nag AwsSolutions Pack: %s', (name, func) => {
  test('No unsuppressed errors', () => {
    const app = new cdk.App();
    const stack = func(app);
    cdk.Aspects.of(app).add(new AwsSolutionsChecks());
    const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
    try {
      expect(errors).toHaveLength(0);
      console.log(`cdk-nag: no errors for ${name}`);
    } catch (e) {
      console.error(JSON.stringify(errors, undefined, 2));
      throw e;
    }
  });
});
