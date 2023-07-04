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

interface CloudTrailStackDataEventProps extends cdk.StackProps {
  cloudTrailBucketName: string; //Log Archiveアカウントに作成したS3バケット名（cdk.jsonで設定）
  targetBuckets: string[]; //CloudTrailデータイベント取得の対象となるS3バケット名を指定（cdk.jsonで指定）
  controlTowerKMSKeyArn: string; //CloudTrail 暗号化キー（ControlTowerの暗号化キーを使用. cdk.jsonで指定）
}

export class CloudTrailDataEvent extends Construct {
  constructor(scope: Construct, id: string, props: CloudTrailStackDataEventProps) {
    super(scope, id);

    //1 find a bucket for cloudtrail
    const cloudTrailBucket = s3.Bucket.fromBucketName(this, 'cloudTrailBucket', props.cloudTrailBucketName);

    //2 get KMS CMK for CloudTrail. it usually use KMS key created in Control Tower
    const ctKmsKey = kms.Key.fromKeyArn(this, 'ct-kmskey', props.controlTowerKMSKeyArn);

    //3 create CloudWatch Logs Group for CloudTrail data logging
    const cloudTrailLogGroup = new cwl.LogGroup(this, 'LogGroup', {
      retention: cwl.RetentionDays.TWO_WEEKS,
    });

    //4 add target S3 buckets for data event to the selector
    const s3eventSelectors: S3EventSelector[] = [];
    for (const bucketName of props.targetBuckets) {
      s3eventSelectors.push({ bucket: s3.Bucket.fromBucketName(this, bucketName, bucketName) });
    }

    //5 Create CloudTrail data event Trails
    const cloudtrail = new trail.Trail(this, 'Default', {
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
