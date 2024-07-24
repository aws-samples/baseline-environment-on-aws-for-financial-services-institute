import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';
import { GuestMarketDataStack } from '../lib/bleafsi-guest-market-data-stack';

/*
 * BLEA-FSI Market Data Sample application stack
 */

const app = new cdk.App();

// ----------------------- Guest Market Data System Stacks for development ------------------------------
const devStack = new GuestMarketDataStack(app, `${PjPrefix}-Dev`, {
  description: 'BLEA for FSI Market Data (uksb-1tupboc63) (tag:guest-market-data-sample)',
  ...DevParameter,
});

// // ----------------------- Guest Market Data System Stacks for staging ------------------------------
// const stagingStack = new GuestMarketDataStack(app, `${PjPrefix}-Stage`, DevParameter);

// // ----------------------- Guest Market Data System Stacks for production ------------------------------
// const prodStack = new GuestMarketDataStack(app, `${PjPrefix}-Prod`, DevParameter);

// --------------------------------- Tagging  -------------------------------------
// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(devStack).add(envTagName, DevParameter.envName);
// cdk.Tags.of(stagingStack).add(envTagName, StageParameter.envName);
// cdk.Tags.of(prodStack).add(envTagName, ProdParameter.envName);
