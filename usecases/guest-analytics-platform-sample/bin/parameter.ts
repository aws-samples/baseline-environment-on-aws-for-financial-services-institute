import * as cdk from 'aws-cdk-lib';

/*
 * BLEA-FSI Analytics Platform Sample application parameters denifition
 * pattern:
 *  Simple data lake
 */

// stack specific parameters
export interface StackParameter extends cdk.StackProps {
  envName: string;
  //SimpleDataLake Stack用のパラメータ定義
  simpleDataLake: {
    notifyEmail: string;
    vpcCidr: string;
  };
}

// Project name prefix
export const PjPrefix = 'BLEAFSI-AnalyticsPlatform';

//// Development environment parameters ////
export const DevParameters: StackParameter = {
  envName: 'Development',
  simpleDataLake: {
    notifyEmail: 'xxx@example.com',
    vpcCidr: '10.4.0.0/16',
  },
};

//// Staging environment parameters ////
export const StageParameters: StackParameter = {
  envName: 'Staging',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
  simpleDataLake: {
    notifyEmail: 'xxx@example.com',
    vpcCidr: '10.4.0.0/16',
  },
};

//// Production environment parameters ////
export const ProdParameters: StackParameter = {
  envName: 'Production',
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
  simpleDataLake: {
    notifyEmail: 'xxx@example.com',
    vpcCidr: '10.4.0.0/16',
  },
};
