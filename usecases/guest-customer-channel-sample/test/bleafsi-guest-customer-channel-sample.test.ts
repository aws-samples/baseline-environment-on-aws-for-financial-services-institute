import * as cdk from 'aws-cdk-lib';
import { Template, Annotations, Match } from 'aws-cdk-lib/assertions';
import { PjPrefix, AppParameter } from '../bin/parameter';
import { CustomerChannelStacks, createStacks } from '../bin/bleafsi-guest-customer-channel-sample';
import { AwsSolutionsChecks } from 'cdk-nag';
import { IdentityManagementType } from '../lib/constructs-l2/connect';

export const TestParameter: AppParameter = {
  envName: 'Test',
  primaryRegion: {
    region: 'ap-northeast-1',
    connectInstance: {
      instanceAlias: 'test-connect-instance-primary',
      identityManagementType: IdentityManagementType.CONNECT_MANAGED,
    },
  },
  secondaryRegion: {
    region: 'ap-southeast-1',
    connectInstance: {
      instanceAlias: 'test-connect-instance-secondary',
    },
  },
  tertiaryRegion: {
    region: 'ap-northeast-3',
  },
  enableCallMonitoring: true,
};

function getStackList(stacks: CustomerChannelStacks): cdk.Stack[] {
  return [stacks.primaryStack, stacks.secondaryStack, stacks.tertiaryStack].filter(
    (stack): stack is cdk.Stack => stack != undefined,
  );
}
describe('snapshot check', () => {
  test('Customer channel sample stacks', () => {
    const appParam = TestParameter;
    if (!appParam.secondaryRegion || !appParam.tertiaryRegion) {
      throw Error(`Required regions are missing in DevParameter`);
    }

    const app = new cdk.App();
    const stacks = createStacks(app, PjPrefix, appParam);
    getStackList(stacks).forEach((stack) => {
      // プラットフォーム間でのハッシュ値の違いを吸収するため、BucketDeploymentのSourceObjectKeysを除外
      const template = Template.fromStack(stack);
      const bucketDeploymentMatcher: Record<string, any> = {};

      // クライアントサイドビルドリソースのハッシュ値プロパティのマッチャーを作成
      Object.entries(template.toJSON().Resources || {}).forEach(([key, value]) => {
        if ((value as any).Type === 'Custom::CDKBucketDeployment') {
          bucketDeploymentMatcher[key] = {
            Properties: {
              SourceObjectKeys: expect.any(Array),
            },
          };
        }
        if ((value as any).Type === 'Custom::CDKNodejsBuild') {
          bucketDeploymentMatcher[key] = {
            Properties: {
              sources: expect.arrayContaining([
                expect.objectContaining({
                  sourceObjectKey: expect.any(String),
                }),
              ]),
            },
          };
        }
      });

      expect(template.toJSON()).toMatchSnapshot({
        Resources: bucketDeploymentMatcher,
      });
    });
  });
});

function createPrimaryStackForNagTest(app: cdk.App): cdk.Stack {
  const stacks = createStacks(app, PjPrefix, {
    envName: TestParameter.envName,
    primaryRegion: TestParameter.primaryRegion,
    enableCallMonitoring: TestParameter.enableCallMonitoring,
  });
  return stacks.primaryStack;
}
function createSecondaryStackForNagTest(app: cdk.App): cdk.Stack {
  // Note: the secondary region's stack depends on the tertiary region's stack.
  const stacks = createStacks(app, PjPrefix, TestParameter);
  return stacks.secondaryStack!;
}
function createTertiaryStackForNagTest(app: cdk.App): cdk.Stack {
  const stacks = createStacks(app, PjPrefix, TestParameter);
  return stacks.tertiaryStack!;
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
