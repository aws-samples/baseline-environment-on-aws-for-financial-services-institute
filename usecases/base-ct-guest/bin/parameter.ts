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
export interface StackParameter extends DefaultParameter {
  securityNotifyEmail: string;
  controlTowerKMSKeyArn: string;
  cloudTrailBucketName: string;
  targetBuckets: string[];
}

// ----------------------- Environment variables for stack ------------------------------
// for Dev - Anonymous account & region
export const DevParameter: StackParameter = {
  envName: 'Development',
  pjPrefix: PjPrefix,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'arn:aws:kms:ap-northeast-1:702542056474:key/17bbcb5a-9b91-40a9-b08f-5d9710e40e70',
  cloudTrailBucketName: 'bleafsi-base-sharedlogs-resource-ygxephon83n9',
  targetBuckets: ['bleafsi-base-cloudtrail-bucketaccesslogs0aa7ed48-il7d6f9z75h0'],
};

//for Staging
export const StageParameter: StackParameter = {
  envName: 'Staging',
  pjPrefix: PjPrefix,
  env: {
    account: '111111111111',
    region: 'ap-northeast-1',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};

//for Prod
export const ProdParameter: StackParameter = {
  envName: 'Production',
  pjPrefix: PjPrefix,
  env: {
    account: '222222222222',
    region: 'ap-northeast-1',
  },
  securityNotifyEmail: 'notify-security@example.com',
  controlTowerKMSKeyArn: 'dummy-key-arn',
  cloudTrailBucketName: 'dummy-bucket-name',
  targetBuckets: ['dummy-bucekt-name'],
};
