import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PjPrefix, DevParameters, StageParameters, ProdParameters } from './parameter';
import { SimpleDataLakeStack } from '../lib/bleafsi-guest-simple-datalake-stack';

/*
 * BLEA-FSI Analytics Simple data lake Sample application stack
 */

const app = new cdk.App();

// ----------------------- Guest System Stacks for development ------------------------------
//Simple DataLake リソースのプロビジョニング
const devStack = new SimpleDataLakeStack(app, `${PjPrefix}-SimpleDataLake-Dev`, DevParameters);

// // ----------------------- Guest System Stacks for staging ------------------------------
// const stagingStack = new SimpleDataLakeStack(app, `${PjPrefix}-SimpleDataLake-Stage`, StageParameters);

// // ----------------------- Guest System Stacks for production ------------------------------
// const prodStack = new SimpleDataLakeStack(app, `${PjPrefix}-SimpleDataLake-Prod`, ProdParameters);

// --------------------------------- Tagging  -------------------------------------
// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';
cdk.Tags.of(devStack).add(envTagName, DevParameters.envName);
//cdk.Tags.of(devStack).add(envTagName, StageParameters.envName);
//cdk.Tags.of(devStack).add(envTagName, ProdParameters.envName);
