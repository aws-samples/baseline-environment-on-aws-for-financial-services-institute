import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/*
 * ログ集約バケットを作成
 */
export class S3BucketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Create Bucket for consolidated logging [CloudTrail S3 Data Event or Config log in Osaka region]

    // Archive Bucket for conslidated log bucket
    const archiveLogsBucket = new s3.Bucket(this, 'ArchiveLogsBucket', {
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(2555),
          transitions: [
            {
              transitionAfter: cdk.Duration.days(90),
              storageClass: s3.StorageClass.GLACIER,
            },
          ],
        },
      ],
    });
    //protection from deleting objects
    archiveLogsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [archiveLogsBucket.arnForObjects('*')],
      }),
    );

    const logsBucket = new s3.Bucket(this, 'logsBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsBucket: archiveLogsBucket,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });
    //protection from deleting objects
    logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [logsBucket.arnForObjects('*')],
      }),
    );

    // Attaches S3 resource policy
    const logsBucketPolicy1 = new iam.PolicyStatement({
      sid: 'AWSBucketPermissions',
      effect: iam.Effect.ALLOW,
      resources: [logsBucket.bucketArn],
      principals: [
        new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
        new iam.ServicePrincipal('config.amazonaws.com'),
      ],
      actions: ['s3:GetBucketAcl', 's3:ListBucket'],
    });
    logsBucket.addToResourcePolicy(logsBucketPolicy1);

    const logsBucketPolicy2 = new iam.PolicyStatement({
      sid: 'AWSBucketDelivery',
      effect: iam.Effect.ALLOW,
      resources: [`${logsBucket.bucketArn}/*/*`],
      principals: [
        new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
        new iam.ServicePrincipal('config.amazonaws.com'),
      ],
      actions: ['s3:PutObject'],
      conditions: {
        StringEquals: {
          's3:x-amz-acl': 'bucket-owner-full-control',
        },
      },
    });
    logsBucket.addToResourcePolicy(logsBucketPolicy2);

    //CFn output
    new cdk.CfnOutput(this, 'Logs Bucket', {
      value: logsBucket.bucketName,
      description: 'Bucket for CloudTrail/Config log',
    });
  }
}
