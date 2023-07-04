import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BaseCTStack } from '../lib/bleafsi-base-ct-logging-stack';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';

/*
 * Control Tower Log Archiveアカウントにログ集約 S3 バケットを作成
 */

const app = new cdk.App();

// スタック作成
// for Development
const DevStack = new BaseCTStack(app, `${PjPrefix}-Dev`, {
  env: DevParameter.env,
});

// for Staging
/*const StageStack = new BaseCTStack(app, `${PjPrefix}-Stage`, {
  env: StageParameter.env,
});*/

// for Production
/*const ProdStack = new BaseCTStack(app, `${PjPrefix}-Prod`, {
  env: ProdParameter.env,
});*/

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(DevStack).add(envTagName, DevParameter.envName);
//cdk.Tags.of(StageStack).add(envTagName, StageParameter.envName);
//cdk.Tags.of(ProdStack).add(envTagName, ProdParameter.envName);
