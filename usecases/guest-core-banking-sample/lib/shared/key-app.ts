import { Construct } from 'constructs';
import { aws_kms as kms } from 'aws-cdk-lib';
import { CrossRegionSsmParam } from './cross-region-ssm-param';

/*
 * KMS Keyの作成
 */

export class KeyApp extends Construct {
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // CMK
    const kmsKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for App',
      alias: `${id}-for-app`,
    });
    this.kmsKey = kmsKey;
  }

  // SSM Parameter to put KMS Key ARN
  putKeyArnToSsmParam(paramName: string, baseRegion: string, envName: string) {
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion,
      envName,
    });
    crossRegionSsmParam.put(paramName, this.kmsKey.keyArn);
  }
}
