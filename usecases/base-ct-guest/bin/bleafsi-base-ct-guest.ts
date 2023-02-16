import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BaseCTStack } from '../lib/bleafsi-base-ct-guest-stack';
import { DevParameter } from './parameter';

/*
 * Control Tower ゲストアカウントの東京リージョンにガバナンスベースをデプロイ
 */

const app = new cdk.App();

// スタック作成
new BaseCTStack(app, `${DevParameter.pjPrefix}-Dev`, {
  notifyEmail: DevParameter.securityNotifyEmail,
  cloudTrailBucketName: DevParameter.cloudTrailBucketName,
  targetBuckets: DevParameter.targetBuckets,
  controlTowerKMSKeyArn: DevParameter.controlTowerKMSKeyArn,
  env: DevParameter.env,
});

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'guest';
cdk.Tags.of(app).add(envTagName, envTagVal);
