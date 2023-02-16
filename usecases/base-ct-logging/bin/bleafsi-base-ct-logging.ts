import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BaseCTStack } from '../lib/bleafsi-base-ct-logging-stack';
import { DevParameter } from './parameter';

/*
 * Control Tower Log Archiveアカウントにログ集約 S3 バケットを作成
 */

const app = new cdk.App();

// スタック作成
new BaseCTStack(app, `${DevParameter.pjPrefix}-Dev`, {
  env: DevParameter.env,
});

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'logging';
cdk.Tags.of(app).add(envTagName, envTagVal);
