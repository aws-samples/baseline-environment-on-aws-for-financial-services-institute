import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TrailDataEventStack } from '../lib/bleafsi-trail-dataevent-stack';

/*
 * ゲストアカウントでの CloudTrail S3データイベントの有効化
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
  } else {
    return procEnvDefault;
  }
}

// ----------------------- Guest Account Base Stacks ------------------------------
new TrailDataEventStack(app, `${pjPrefix}-trail`, {
  cloudTrailBucketName: envVals['cloudTrailBucketName'], //Log Archiveアカウントに作成したS3バケット名
  targetBuckets: envVals['targetBuckets'], //CloudTrailデータイベント取得の対象となるS3バケット名を指定
  controlTowerKMSKeyArn: envVals['controlTowerKMSKeyArn'], //CloudTrail 暗号化キー（ControlTowerの暗号化キーを使用）
  env: getProcEnv(),
});
// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
const envTagVal = 'guest';
cdk.Tags.of(app).add(envTagName, envTagVal);
