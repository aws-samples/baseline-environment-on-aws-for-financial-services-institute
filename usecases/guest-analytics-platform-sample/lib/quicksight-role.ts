import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IamRole } from './constructs/bleafsi-iam-role';
import { aws_iam as iam } from 'aws-cdk-lib';
import { KmsKey } from './constructs/bleafsi-kms-key';

export interface QuickSightRolePolicyProps {
  //Athena WorkGroupを暗号化するKMS Key
  athenaKmsKey: KmsKey;
  //S3バケットを暗号化するKMS Key
  s3KmsKey: KmsKey;
  //normalizeデータを格納するS3バケット名
  normalizedBucketName: string;
  //analyticsデータを格納するS3バケット名
  analyticsBucketName: string;
  //マスターデータを格納するS3バケット名
  masterDataBucketName: string;
  //Athena Queryの結果を保管するS3バケット名
  athenaQueryResultBucketName: string;
}

/*
 * QuickSightをAthena経由でクエリーを実行するために必要な権限を設定する
 */
export class QuickSightRole extends Construct {
  readonly quickSightRole: iam.IRole;
  constructor(scope: Construct, id: string, props: QuickSightRolePolicyProps) {
    super(scope, id);

    //const QUICK_SIGHT_ROLE = 'service-role/aws-quicksight-service-role-v0';
    const QUICK_SIGHT_ROLE = 'bleafsi-quicksight-role';

    //QuickSight アクセス用のRoleの作成
    const role = new IamRole(this, 'QuickSightRole', {
      roleName: QUICK_SIGHT_ROLE,
      servicePrincipal: 'quicksight.amazonaws.com',
    });

    //Normalized用 、Analysis用、Athena 検索結果用 のS3 Bucket にアクセスするためのポリシーの追加
    role.addPolicy(this.getIamPolicy(props), 'Bleafsi-QuickSight-S3Policy');

    //Athena用のマネージド権限
    role.addAwsManagedPolicy('service-role/AWSQuicksightAthenaAccess');

    this.quickSightRole = role.iamRole;
  }

  /**
   * S3 Bucket および KMSキーにアクセスするためのIAMポリシーステートメントを返す
   */
  getIamPolicy(props: QuickSightRolePolicyProps) {
    return {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['kms:Decrypt', 'kms:GenerateDataKey'],
          Resource: [props.athenaKmsKey.key.keyArn, props.s3KmsKey.key.keyArn],
        },
        {
          Action: ['s3:ListBucket'],
          Effect: 'Allow',
          Resource: [
            `arn:aws:s3:::${props.normalizedBucketName}`,
            `arn:aws:s3:::${props.analyticsBucketName}`,
            `arn:aws:s3:::${props.masterDataBucketName}`,
          ],
        },
        {
          Action: ['s3:GetObject', 's3:GetObjectVersion'],
          Effect: 'Allow',
          Resource: [
            `arn:aws:s3:::${props.normalizedBucketName}/*`,
            `arn:aws:s3:::${props.analyticsBucketName}/*`,
            `arn:aws:s3:::${props.masterDataBucketName}/*`,
          ],
        },
        {
          Action: ['s3:ListBucketMultipartUploads', 's3:GetBucketLocation'],
          Effect: 'Allow',
          Resource: [`arn:aws:s3:::${props.athenaQueryResultBucketName}`],
        },
        {
          Effect: 'Allow',
          Action: ['s3:PutObject', 's3:GetObject', 's3:AbortMultipartUpload', 's3:ListMultipartUploadParts'],
          Resource: [`arn:aws:s3:::${props.athenaQueryResultBucketName}/*`],
        },
      ],
    };
  }
}
