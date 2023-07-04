import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_events_targets as eventtarget } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';

export interface ECRProps {
  repositoryName: string;
  alarmTopic: sns.Topic;
  secondaryRegion: string;
}

/*
 * ECRの作成
 */

export class ECR extends Construct {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: ECRProps) {
    super(scope, id);

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

    // Add a target to the SNS topic
    const target = new eventtarget.SnsTopic(props.alarmTopic);

    this.repository.onImageScanCompleted('ImageScanComplete').addTarget(target);
  }
}
