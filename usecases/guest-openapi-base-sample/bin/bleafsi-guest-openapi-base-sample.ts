import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SampleOpenApiStack } from '../lib/bleafsi-openapi-base-sample-stack';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';

const app = new cdk.App();

// スタック作成
// for Development
const DevStack = new SampleOpenApiStack(app, `${PjPrefix}-Dev`, DevParameter);

//for Staging
//const StageStack = new SampleOpenApiStack(app, `${PjPrefix}-Stage`, StageParameter);

//for Production
//const ProdStack = new SampleOpenApiStack(app, `${PjPrefix}-Prod`, ProdParameter);

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(DevStack).add(envTagName, DevParameter.envName);
// cdk.Tags.of(StageStack).add(envTagName, StageParameter.envName);
// cdk.Tags.of(ProdStack).add(envTagName, ProdParameter.envName);
