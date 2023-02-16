import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/*
 * SSM セッションマネージャーの監査ログ取得用のS3バケットの作成
 * S3バケットはゲストアカウント上に作成される
 */
export class SessionManagerLog extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // SessionManager 監査ログ用のバケット作成
    const logBucket = new BucketForSessionManagerLog(this, 'Bucket');

    // WritePolicyポリシーの作成
    new WritePolicyForInstanceProfile(this, 'WritePolicy', logBucket.bucket.bucketArn);

    this.bucket = logBucket.bucket;
  }
}

/////////// private Construct /////////////////
/*
 * SessionManager 監査ログ用のバケット作成
 */
class BucketForSessionManagerLog extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string) {
    super(scope, id);
    // 1 アクセスログ バケット作成
    const accessLogsBucket = new AccessLogsBucket(this, 'AccessLogs');

    // 2 監査ログ用のバケット作成
    const bucket = new s3.Bucket(this, 'Default', {
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      serverAccessLogsBucket: accessLogsBucket.bucket,
    });
    //オブジェクトの削除を禁止するポリシー追加
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [bucket.arnForObjects('*')],
      }),
    );

    this.bucket = bucket;
  }
}

/*
 * アクセスログ用のバケット作成
 */
class AccessLogsBucket extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new s3.Bucket(this, 'Default', {
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

    //オブジェクトの削除を禁止するポリシー追加
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [bucket.arnForObjects('*')],
      }),
    );
    this.bucket = bucket;
  }
}

/*
 * EC2インスタンスプロファイルにアタッチする、S3バケット出力を許可するポリシー
 */
class WritePolicyForInstanceProfile extends Construct {
  constructor(scope: Construct, id: string, bucketArn: string) {
    super(scope, id);

    // Inline Policyの設定
    const inlineIamPolicy1 = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObjectAcl', 's3:PutObject'],
    });
    const inlineIamPolicy2 = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetEncryptionConfiguration'],
    });

    //add bucket resource to role's inline policy
    inlineIamPolicy1.addResources(`${bucketArn}/AWSLogs/*`);
    inlineIamPolicy2.addResources(`${bucketArn}`);

    // ポリシー名 'WritePolicy'作成
    new iam.ManagedPolicy(this, `Default`, {
      statements: [inlineIamPolicy1, inlineIamPolicy2],
    });
  }
}
