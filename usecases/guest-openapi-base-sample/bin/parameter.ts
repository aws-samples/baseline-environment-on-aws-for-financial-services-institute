import * as cdk from 'aws-cdk-lib';

/*
 * BLEA-FSI OpenAPI Base Sample application parameters denifition
 */

// stack specific parameters
export interface StackParameter extends cdk.StackProps {
  envName: string;
  customdomainName: string;
  alterdomainName: string;
  certIdarnApigw: string;
  certIdarnCf: string;
}
// Project name prefix
export const PjPrefix = 'BLEAFSI-OpenApi-Base';

//// Development environment parameters ////
export const DevParameter: StackParameter = {
  envName: 'Development',
  customdomainName: 'api.xxxx.xxxxx',
  alterdomainName: 'openapi.xxxx.xxxx',
  certIdarnApigw: 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  certIdarnCf: 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
};

//// Staging environment parameters ////
export const StageParameter: StackParameter = {
  envName: 'Staging',
  customdomainName: 'api.xxxx.xxxxx',
  alterdomainName: 'openapi.xxxx.xxxx',
  certIdarnApigw: 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  certIdarnCf: 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
};

//// Production environment parameters ////
export const ProdParameter: StackParameter = {
  envName: 'Production',
  customdomainName: 'api.xxxx.xxxxx',
  alterdomainName: 'openapi.xxxx.xxxx',
  certIdarnApigw: 'arn:aws:acm:ap-northeast-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  certIdarnCf: 'arn:aws:acm:us-east-1:xxxxxxxxxxxx:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
};
