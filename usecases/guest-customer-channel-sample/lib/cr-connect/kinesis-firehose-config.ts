import { Construct } from 'constructs';
import * as kinesisfirehose from 'aws-cdk-lib/aws-kinesisfirehose';
import { Instance } from './instance';
import { InstanceStorageConfig } from './instance-storage-config';

export interface KinesisFirehoseStorageConfigProps {
  readonly instance: Instance;
  readonly resourceType: string;
  readonly deliveryStream: kinesisfirehose.CfnDeliveryStream;
}

export class KinesisFirehoseStorageConfig extends InstanceStorageConfig {
  constructor(scope: Construct, id: string, props: KinesisFirehoseStorageConfigProps) {
    super(scope, id, {
      instance: props.instance,
      resourceType: props.resourceType,
      storageConfig: {
        storageType: 'KINESIS_FIREHOSE',
        kinesisFirehoseConfig: {
          firehoseArn: props.deliveryStream.attrArn,
        },
      },
    });

    this.node.addDependency(props.deliveryStream);
  }
}
