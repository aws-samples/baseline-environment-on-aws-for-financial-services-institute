import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PjPrefix } from '../bin/parameter';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { Bucket } from './constructs/bleafsi-s3-bucket';

/*
 * SSM セッションマネージャーの監査ログ取得用のS3バケットの作成
 * S3バケットはゲストアカウント上に作成される
 */
export class SessionManagerLog extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // SessionManager 監査ログ用のバケット作成
    // 必要に応じて removalPolicyは変更する。DESTROYはスタック削除時に自動的にバケットも削除される
    const logBucket = new Bucket(this, 'Bucket', {
      bucketName: `${PjPrefix.toLowerCase()}-sm-auditlog-${cdk.Stack.of(this).account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    logBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'Restrict Delete* Actions',
        effect: iam.Effect.DENY,
        actions: ['s3:DeleteObject'],
        principals: [new iam.AnyPrincipal()],
        resources: [logBucket.bucket.arnForObjects('*')],
      }),
    );

    // WritePolicyポリシーの作成
    new WritePolicyForInstanceProfile(this, 'WritePolicy', logBucket.bucket.bucketArn);

    this.bucket = logBucket.bucket;
  }
}

/////////// private Construct /////////////////

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
