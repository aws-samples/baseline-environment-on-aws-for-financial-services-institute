import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { Bucket } from '../lib/bleafsi-s3-bucket';
import { KmsKey } from '../lib/bleafsi-kms-key';

/*
 * このサブプロジェクトのlib配下に作成した S3 Bucket Construct をテストするためのStack
 */

export class S3Stack extends cdk.Stack {
  readonly buckets: Bucket[];
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.buckets = [];

    //1 S3 バケット作成
    const bucket1 = new Bucket(this, 'sampleBucket1');
    this.buckets.push(bucket1);

    //removal policy and bucket name を指定
    const bucket2 = new Bucket(this, 'sampleBucket2', {
      bucketName: `bleafsi-s3-construct-1-${cdk.Stack.of(this).account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.buckets.push(bucket2);

    ////KMS AWS Managed Key
    const bucket3 = new Bucket(this, 'sampleBucket3', {
      encryption: s3.BucketEncryption.KMS_MANAGED,
    });
    this.buckets.push(bucket3);

    //KMS を指定したが、keyは未指定
    const bucket4 = new Bucket(this, 'sampleBucket4', {
      encryption: s3.BucketEncryption.KMS,
    });
    this.buckets.push(bucket4);

    //KMS と key を指定
    const kmskey = new KmsKey(this, 'S3Encryption');
    const bucket5 = new Bucket(this, 'sampleBucket5', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmskey.key,
    });
    this.buckets.push(bucket5);

    //CFn output
    new cdk.CfnOutput(this, 'Bucket1 bucket name', {
      value: bucket1.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'Bucket2 bucekt name', {
      value: bucket2.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'Bucket3 key arn', {
      value: bucket3.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'Bucket4 key arn', {
      value: bucket4.encryptionKey.keyArn,
    });
    new cdk.CfnOutput(this, 'Bucket5 key arn', {
      value: bucket5.encryptionKey.keyArn,
    });
  }
}
