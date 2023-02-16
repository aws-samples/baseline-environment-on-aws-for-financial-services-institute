import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BaseCTStack } from '../lib/bleafsi-base-ct-guest-stack';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';

/*
 * Control Tower ゲストアカウントの東京リージョンにガバナンスベースをデプロイ
 */

const app = new cdk.App();

// スタック作成
// for Development
const DevStack = new BaseCTStack(app, `${PjPrefix}-Dev`, {
  env: DevParameter.env,
  notifyEmail: DevParameter.securityNotifyEmail,
  cloudTrailBucketName: DevParameter.cloudTrailBucketName,
  targetBuckets: DevParameter.targetBuckets,
  controlTowerKMSKeyArn: DevParameter.controlTowerKMSKeyArn,
});

// for Staging
const StageStack = new BaseCTStack(app, `${PjPrefix}-Stage`, {
  env: StageParameter.env,
  notifyEmail: StageParameter.securityNotifyEmail,
  cloudTrailBucketName: StageParameter.cloudTrailBucketName,
  targetBuckets: StageParameter.targetBuckets,
  controlTowerKMSKeyArn: StageParameter.controlTowerKMSKeyArn,
});

// for Production
const ProdStack = new BaseCTStack(app, `${PjPrefix}-Prod`, {
  env: ProdParameter.env,
  notifyEmail: ProdParameter.securityNotifyEmail,
  cloudTrailBucketName: ProdParameter.cloudTrailBucketName,
  targetBuckets: ProdParameter.targetBuckets,
  controlTowerKMSKeyArn: ProdParameter.controlTowerKMSKeyArn,
});

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(DevStack).add(envTagName, DevParameter.envName);
cdk.Tags.of(StageStack).add(envTagName, StageParameter.envName);
cdk.Tags.of(ProdStack).add(envTagName, ProdParameter.envName);
