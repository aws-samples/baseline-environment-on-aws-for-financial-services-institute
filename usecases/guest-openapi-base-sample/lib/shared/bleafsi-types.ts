import * as cdk from 'aws-cdk-lib';

export interface OpenApiBaseContextProps extends cdk.StackProps {
  customdomainName: string;
  alterdomainName: string;
  certIdarnApigw: string;
  certIdarnCf: string;
}
