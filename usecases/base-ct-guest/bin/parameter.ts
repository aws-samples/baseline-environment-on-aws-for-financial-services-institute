import * as cdk from 'aws-cdk-lib';

/*
 * BLEA-FSI Gavernance base guest account parameters denifition
 */

//stack specific parameters
export interface StackParameter extends cdk.StackProps {
  envName: string;
  account?: string;
  primary: {
    region: string;
  };
  secondary?: {
    region: string;
  };
  securityNotifyEmail: string;
  controlTowerKMSKeyArn: string;
  cloudTrailBucketName: string;
  targetBuckets: string[];
}

// Unique project prefix
export const PjPrefix = 'BLEAFSI-Base';

// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  primary: {
    region: 'ap-northeast-1',
  },
  secondary: {
    region: 'ap-northeast-3',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'arn:aws:kms:ap-northeast-1:1111111111xxx:key/xxx-xxx-xxx-xxx-xxxxxx',
  cloudTrailBucketName: 'bleafsi-base-sharedlogs-resource-ygxephon83n9',
  targetBuckets: ['bleafsi-base-cloudtrail-bucketaccesslogs0aa7ed48-il7d6f9z75h0'],
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  account: '111111111111',
  primary: {
    region: 'ap-northeast-1',
  },
  secondary: {
    region: 'ap-northeast-3',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};

// Parameter for Production
export const ProdParameter: StackParameter = {
  envName: 'Production',
  account: '222222222222',
  primary: {
    region: 'ap-northeast-1',
  },
  secondary: {
    region: 'ap-northeast-3',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};
