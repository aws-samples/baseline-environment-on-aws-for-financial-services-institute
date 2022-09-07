import * as cdk from 'aws-cdk-lib';

export interface RegionEnv {
  region: string;
  vpcCidr: string;
  tgwAsn: number;
}

export interface CoreBankingContextProps extends cdk.StackProps {
  pjPrefix: string;
  envName: string;
  notifyEmail: string;
  dbUser: string;
  primary: RegionEnv;
  secondary: RegionEnv;
}
