import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/*
 * Session Managerログ保管用のS3バケットの作成
 * S3バケットはゲストアカウント上に作成される
 */

export class SessionManagerLogStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // Archive Bucket for CloudTrail
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
    // ## Create a Managed Policy for Session Manager S3 Write
    const inlineIamPolicy1 = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PubObjectAcl', 's3:PutObject'],
    });
    const inlineIamPolicy2 = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetEncryptionConfiguration'],
    });

    new iam.ManagedPolicy(this, `WritePolicy`, {
      statements: [inlineIamPolicy1, inlineIamPolicy2],
    });

    // ## Bucket for Session Manager Log
    const sessionManageLogBucket = new s3.Bucket(this, 'SessionManagerLogsBucket', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      serverAccessLogsBucket: archiveLogsBucket,
    });
    //protection from deleting objects
    sessionManageLogBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [sessionManageLogBucket.arnForObjects('*')],
      }),
    );

    //add bucket resource to role's inline policy
    inlineIamPolicy1.addResources(`${sessionManageLogBucket.bucketArn}/AWSLogs/*`);
    inlineIamPolicy2.addResources(`${sessionManageLogBucket.bucketArn}`);

    //## CFn output
    new cdk.CfnOutput(this, 'SSM Session Manager Log Bucket', {
      value: sessionManageLogBucket.bucketName,
      description: 'Bucket for SSM Session Manager Log Bucket',
    });
  }
}
