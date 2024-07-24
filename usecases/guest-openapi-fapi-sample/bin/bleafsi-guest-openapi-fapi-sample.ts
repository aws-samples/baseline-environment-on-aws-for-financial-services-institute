import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OpenApiFapiStack } from '../lib/primary/bleafsi-guest-openapi-fapi-stack';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';

const app = new cdk.App();

// スタック作成
//for Development
const DevPrimaryStack = new OpenApiFapiStack(app, `${PjPrefix}-primary-Dev`, {
  description: 'BLEA for FSI OpenAPI fapi (uksb-1tupboc63) (tag:guest-openapi-fapi-sample)',
  ...DevParameter,
  env: {
    account: DevParameter.account,
    region: DevParameter.primaryRegion.region,
  },
});

//for Staging
/*const StagePrimaryStack = new OpenApiFapiStack(app, `${PjPrefix}-primary-Stage`, {
  ...StageParameter,
  env: {
    account: StageParameter.account,
    region: StageParameter.primaryRegion.region,
  },
}); */

//for Production
/*const ProdPrimaryStack = new OpenApiFapiStack(app, `${PjPrefix}-primary-Prod`, {
  ...ProdParameter,
  env: {
    account: ProdParameter.account,
    region: ProdParameter.primaryRegion.region,
  },
}); */

// --------------------------------- Tagging  -------------------------------------

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(DevPrimaryStack).add(envTagName, DevParameter.envName);
// cdk.Tags.of(StagePrimaryStack).add(envTagName, StageParameter.envName);
// cdk.Tags.of(ProdPrimaryStack).add(envTagName, ProdParameter.envName);
