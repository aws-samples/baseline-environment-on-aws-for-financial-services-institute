import { Environment } from 'aws-cdk-lib';

// ----------------------- constant definition ------------------------------
//Default environment
const EnvDefault = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// ----------------------- Environment variables interface definition ------------------------------
//Default parameter definition
interface DefaultParameter {
  envName: string;
  env?: Environment;
}

//specific parameter definition
export interface StackParameter extends DefaultParameter {
  securityNotifyEmail: string;
  controlTowerKMSKeyArn: string;
  cloudTrailBucketName: string;
  targetBuckets: string[];
}

// ----------------------- Environment variables for stack ------------------------------
// Unique project prefix
export const PjPrefix = 'BLEAFSI-Base';

// Parameter for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  env: EnvDefault,
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};

// Parameter for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};

// Parameter for Production
export const ProdParameter: StackParameter = {
  envName: 'Production',
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};
