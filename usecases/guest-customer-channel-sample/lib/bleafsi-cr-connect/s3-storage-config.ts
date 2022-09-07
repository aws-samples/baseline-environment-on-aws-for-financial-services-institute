import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Instance } from './instance';
import { InstanceStorageConfig } from './instance-storage-config';

export interface S3StorageConfigProps {
  readonly instance: Instance;
  readonly resourceType: string;
  readonly bucket: s3.IBucket;
  readonly bucketPrefix: string;
  readonly key?: kms.IKey;
}

export class S3StorageConfig extends InstanceStorageConfig {
  constructor(scope: Construct, id: string, props: S3StorageConfigProps) {
    super(scope, id, {
      instance: props.instance,
      resourceType: props.resourceType,
      storageConfig: {
        storageType: 'S3',
        s3config: {
          bucketName: props.bucket.bucketName,
          bucketPrefix: props.bucketPrefix,
          encryptionConfig: props.key
            ? {
                encryptionType: 'KMS',
                keyId: props.key.keyArn, // provide the full ARN, not the ID
              }
            : undefined,
        },
      },
    });

    this.node.addDependency(props.instance);
    this.node.addDependency(props.bucket);
    if (props.key) {
      this.node.addDependency(props.key);
    }
  }
}
