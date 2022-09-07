import * as cdk from 'aws-cdk-lib';

export interface MarketDataContextProps extends cdk.StackProps {
  pjPrefix: string;
  envName: string;
  vpcCidr: string;
  region: string;
  account: string;
  notifyEmail: string;
}
