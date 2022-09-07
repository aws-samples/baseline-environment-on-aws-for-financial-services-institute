import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_events_targets as eventtarget } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

export interface ECRStackProps extends cdk.NestedStackProps {
  repositoryName: string;
  alarmTopic: sns.Topic;
  secondaryRegion: string;
}

export class ECRStack extends cdk.NestedStack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: ECRStackProps) {
    super(scope, id, props);

    // Create a repository
    this.repository = new ecr.Repository(this, props.repositoryName, {
      imageScanOnPush: true,
    });
    new ecr.CfnReplicationConfiguration(this, `CrrConf`, {
      replicationConfiguration: {
        rules: [
          {
            destinations: [
              {
                region: props.secondaryRegion,
                registryId: cdk.Stack.of(this).account,
              },
            ],
          },
        ],
      },
    });
    const target = new eventtarget.SnsTopic(props.alarmTopic);

    this.repository.onImageScanCompleted('ImageScanComplete').addTarget(target);
  }
}
