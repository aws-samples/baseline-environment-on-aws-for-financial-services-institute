import { Environment } from 'aws-cdk-lib';

// ----------------------- Environment variables interface definition ------------------------------
const PjPrefix = 'BLEAFSI-Base';

//Default parameter definition
interface DefaultParameter {
  pjPrefix: string;
  env?: Environment;
  envName: string;
}

//specific parameter definition
export type StackParameter = DefaultParameter; // パラメータを追加しない

// ----------------------- Environment variables for stack ------------------------------
// for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  pjPrefix: PjPrefix,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
};

//for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  pjPrefix: PjPrefix,
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
};

//for Prod
export const ProdParameter: StackParameter = {
  envName: 'Production',
  pjPrefix: PjPrefix,
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
};
