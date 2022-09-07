import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_cloudtrail as trail } from 'aws-cdk-lib';
import { aws_logs as cwl } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';
import { S3EventSelector } from 'aws-cdk-lib/aws-cloudtrail';

/*
 * CloudTrail S3データイベントの有効化
 * ログはLog Archiveアカウントの集約バケットに保管される
 */

interface TrailStackProps extends cdk.StackProps {
  cloudTrailBucketName: string; //Log Archiveアカウントに作成したS3バケット名（cdk.jsonで設定）
  targetBuckets: string[]; //CloudTrailデータイベント取得の対象となるS3バケット名を指定（cdk.jsonで指定）
  controlTowerKMSKeyArn: string; //CloudTrail 暗号化キー（ControlTowerの暗号化キーを使用. cdk.jsonで指定）
}

export class TrailDataEventStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TrailStackProps) {
    super(scope, id, props);

    // Enryption key for CloudTrail. Use KMS key in Control Tower
    const ctKmsKey = kms.Key.fromKeyArn(this, 'ct-kmskey', props.controlTowerKMSKeyArn);

    // CloudWatch Logs Group for CloudTrail data logging
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'CloudTrailLogGroup', {
      retention: cwl.RetentionDays.TWO_WEEKS,
    });

    //find a bucket for cloudtrail
    const cloudTrailBucket = s3.Bucket.fromBucketName(this, 'cloudTrailBucket', props.cloudTrailBucketName);

    // generate resources arn for field selectors
    const s3eventSelectors: S3EventSelector[] = [];
    for (const bucketName of props.targetBuckets) {
      s3eventSelectors.push({ bucket: s3.Bucket.fromBucketName(this, bucketName, bucketName) });
    }

    // Create CloudTrail for data logging
    const cloudtrail = new trail.Trail(this, 'CloudTrail', {
      trailName: 's3-dataevent-trail',
      bucket: cloudTrailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      cloudWatchLogGroup: cloudTrailLogGroup,
      encryptionKey: ctKmsKey,
      sendToCloudWatchLogs: true,
    });

    cloudtrail.addS3EventSelector(s3eventSelectors, {
      includeManagementEvents: false,
      readWriteType: trail.ReadWriteType.ALL,
    });
  }
}
