import * as cdk from 'aws-cdk-lib';

/*
 * BLEA-FSI Gavernance base logging account parameters denifition
 */

//specific parameter definition
export interface StackParameter extends cdk.StackProps {
  envName: string;
}

//Unique project prefix
export const PjPrefix = 'BLEAFSI-LogBase';

// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
};

// Parameter for Prod
export const ProdParameter: StackParameter = {
  envName: 'Production',
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
};
