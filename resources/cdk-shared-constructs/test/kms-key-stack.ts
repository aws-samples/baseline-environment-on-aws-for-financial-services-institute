import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { KmsKey } from '../lib/bleafsi-kms-key';

/*
 * このサブプロジェクトのlib配下に作成した S3 Bucket Construct をテストするためのStack
 */

export class KmsKeyStack extends cdk.Stack {
  readonly keys: KmsKey[];
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.keys = [];

    const kmskey1 = new KmsKey(this, 'SamleKey1');
    this.keys.push(kmskey1);

    const kmskey2 = new KmsKey(this, 'SampleKey2', {
      alias: 'alias/cloudtrail',
      description: 'this key is used for encryption of CloudTrail trail',
    });

    kmskey2.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['kms:GenerateDataKey*'],
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        resources: ['*'],
        conditions: {
          StringLike: {
            'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(this).account}:trail/*`],
          },
        },
      }),
    );
    this.keys.push(kmskey2);
  }
}
