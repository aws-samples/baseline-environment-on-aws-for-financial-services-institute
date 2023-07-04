import * as cdk from 'aws-cdk-lib';

/*
 * BLEA-FSI Market Data Sample application parameters denifition
 */

// stack specific parameters
export interface StackParameter extends cdk.StackProps {
  envName: string;
  securityNotifyEmail: string;
  controlTowerKMSKeyArn?: string;
  clouldTrailBucketName?: string;
  targetBuckets?: string[];
  vpcCidr: string;
}
// Project name prefix
export const PjPrefix = 'BLEAFSI-MarketData';

//// Development environment parameters ////
export const DevParameter: StackParameter = {
  envName: 'Development',
  securityNotifyEmail: 'notify-security@example.com',
  vpcCidr: '10.100.0.0/16',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
};

//// Staging environment parameters ////
export const StageParameter: StackParameter = {
  envName: 'Staging',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
  securityNotifyEmail: 'notify-security@example.com',
  vpcCidr: '10.100.0.0/16',
};

//// Production environment parameters ////
export const ProdParameter: StackParameter = {
  envName: 'Production',
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
  securityNotifyEmail: 'notify-security@example.com',
  vpcCidr: '10.100.0.0/16',
};
