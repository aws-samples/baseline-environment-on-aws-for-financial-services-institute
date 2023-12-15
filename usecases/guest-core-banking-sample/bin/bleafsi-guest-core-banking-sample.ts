import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CoreBankingPrimaryStack } from '../lib/primary/bleafsi-core-banking-primary-stack';
import { CoreBankingSecondaryStack } from '../lib/secondary/bleafsi-core-banking-secondary-stack';
import { PjPrefix, DevParameter, StageParameter, ProdParameter } from './parameter';

/*
 * BLEA-FSI Core Banking Sample application stack
 */

const app = new cdk.App();

// スタック作成
// for Development
// Primary Region Stack
const DevPrimaryAppStack = new CoreBankingPrimaryStack(app, `${PjPrefix}-primary-Dev`, {
  ...DevParameter,
  env: {
    account: DevParameter.account,
    region: DevParameter.primary.region,
  },
  crossRegionReferences: true,
});

// Secondary Region Stack
const DevSecondaryAppStack = new CoreBankingSecondaryStack(app, `${PjPrefix}-secondary-Dev`, {
  ...DevParameter,
  env: {
    account: DevParameter.account,
    region: DevParameter.secondary.region,
  },
  crossRegionReferences: true,
  auroraSecretName: DevPrimaryAppStack.PrimaryDB.secret.secretName,
  dynamoDbTableName: DevPrimaryAppStack.dynamoDb.tableName,
  tgwRouteTableId: DevPrimaryAppStack.tgwRouteTableId,
});

// for Staging
// Primary Region Stack
/*const StagePrimaryAppStack = new CoreBankingPrimaryStack(app, `${PjPrefix}-primary-Stage`, {
  ...StageParameter,
  env: {
    account: StageParameter.account,
    region: StageParameter.primary.region,
  },
  crossRegionReferences: true,
});

// Secondary Region Stack
const StageSecondaryAppStack = new CoreBankingSecondaryStack(app, `${PjPrefix}-secondary-Stage`, {
  ...StageParameter,
  env: {
    account: StageParameter.account,
    region: StageParameter.secondary.region,
  },
  crossRegionReferences: true,
  auroraSecretName: StagePrimaryAppStack.PrimaryDB.secret.secretName,
  dynamoDbTableName: StagePrimaryAppStack.dynamoDb.tableName,
  tgwRouteTableId: StagePrimaryAppStack.tgwRouteTableId,
});
*/

// for Production
// Primary Region Stack
/*const ProdPrimaryAppStack = new CoreBankingPrimaryStack(app, `${PjPrefix}-primary-Prod`, {
  ...ProdParameter,
  env: {
    account: ProdParameter.account,
    region: ProdParameter.primary.region,
  },
  crossRegionReferences: true,
});

// Secondary Region Stack
const ProdSecondaryAppStack = new CoreBankingSecondaryStack(app, `${PjPrefix}-secondary-Prod`, {
  ...ProdParameter,
  env: {
    account: ProdParameter.account,
    region: ProdParameter.secondary.region,
  },
  crossRegionReferences: true,
  auroraSecretName: ProdPrimaryAppStack.PrimaryDB.secret.secretName,
  dynamoDbTableName: ProdPrimaryAppStack.dynamoDb.tableName,
  tgwRouteTableId: ProdPrimaryAppStack.tgwRouteTableId,
});
*/

// Tagging "Environment" tag to all resources in this app
const envTagName = 'Environment';

cdk.Tags.of(DevPrimaryAppStack).add(envTagName, DevParameter.envName, {
  excludeResourceTypes: ['AWS::EC2::TransitGatewayAttachment'],
});
cdk.Tags.of(DevSecondaryAppStack).add(envTagName, DevParameter.envName);

//cdk.Tags.of(StagePrimaryAppStack).add(envTagName, StageParameter.envName);
//cdk.Tags.of(StageSecondaryAppStack).add(envTagName, StageParameter.envName);

//cdk.Tags.of(ProdPrimaryAppStack).add(envTagName, ProdParameter.envName);
//cdk.Tags.of(ProdSecondaryAppStack).add(envTagName, ProdParameter.envName);
