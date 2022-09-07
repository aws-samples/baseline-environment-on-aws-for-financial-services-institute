import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kms as kms } from 'aws-cdk-lib';
import { CrossRegionSsmParam } from './bleafsi-cross-region-ssm-param-stack';

export class KeyAppStack extends cdk.NestedStack {
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    // CMK
    const kmsKey = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      description: 'for App',
      alias: `${id}-for-app`,
    });
    this.kmsKey = kmsKey;
  }

  putKeyArnToSsmParam(paramName: string, baseRegion: string, envName: string) {
    const crossRegionSsmParam = new CrossRegionSsmParam(this, 'crossRegionSsmParam', {
      baseRegion,
      envName,
    });
    crossRegionSsmParam.put(paramName, this.kmsKey.keyArn);
  }
}
