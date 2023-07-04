import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BaseCTStack } from '../lib/bleafsi-base-ct-guest-stack';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';

/*
 * Control Tower ゲストアカウントの東京リージョンにガバナンスベースをデプロイ
 */

const app = new cdk.App();
const envTagName = 'Environment';

// スタック作成
// for Development
const DevPrimaryStack = new BaseCTStack(app, `${PjPrefix}-Primary-Dev`, {
  ...DevParameter,
  env: {
    account: DevParameter.account,
    region: DevParameter.primary.region,
  },
});
// Tagging "Environment" tag to all resources in this app
cdk.Tags.of(DevPrimaryStack).add(envTagName, DevParameter.envName);

//Secondary regionが定義されている場合のみ
if (DevParameter.secondary != null) {
  const DevSecondaryStack = new BaseCTStack(app, `${PjPrefix}-Secondary-Dev`, {
    ...DevParameter,
    env: {
      account: DevParameter.account,
      region: DevParameter.secondary.region,
    },
  });
  // Tagging "Environment" tag to all resources in this app
  cdk.Tags.of(DevSecondaryStack).add(envTagName, DevParameter.envName);
}

// for Staging
// const StageStack = new BaseCTStack(app, `${PjPrefix}-Stage`, StageParameter);

// for Production
// const ProdStack = new BaseCTStack(app, `${PjPrefix}-Prod`, ProdParameter);

// for CT AFC use
new BaseCTStack(app, `${PjPrefix}-AFC`, {
  ...DevParameter,
});

// Tagging "Environment" tag to all resources in this app
//cdk.Tags.of(StageStack).add(envTagName, StageParameter.envName);
//cdk.Tags.of(ProdStack).add(envTagName, ProdParameter.envName);
