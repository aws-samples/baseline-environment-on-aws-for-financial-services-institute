import { Construct } from 'constructs';
import * as glue_alpha from '@aws-cdk/aws-glue-alpha';
import { Bucket as bucket } from './constructs/bleafsi-s3-bucket';
import { IamRole } from './constructs/bleafsi-iam-role';

/*
 * Glue IAM Role stack
 */
export interface GlueIAMRoleProps {
  bucketForSource: bucket; //インプットデータを保存するS3バケット
  bucketForTarget: bucket; //アウトプットデータを保存するS3バケット
  bucketForGlueAssest: bucket; //Glue用ファイルを保存するS3バケット
  glueSecurityConfig: glue_alpha.SecurityConfiguration;
}

// GlueジョブIAMロールの信頼関係とサービスロールを定義
const glueManagedPolicy = 'service-role/AWSGlueServiceRole';
const glueServiceUrl = 'glue.amazonaws.com';
const glueLogArn = 'arn:aws:logs:*:*:/aws-glue/*';

/*
 * Glue パイプライン用のジョブを作成
 */
export class GlueIAMRole extends Construct {
  public readonly glueIamRole: IamRole;

  constructor(scope: Construct, id: string, props: GlueIAMRoleProps) {
    super(scope, id);

    //GlueジョブのIAMロール、IAMポリシーを定義
    const resoucesListForGlueJobKMSPolicy: any[] = [
      glueLogArn,
      props.glueSecurityConfig.s3EncryptionKey?.keyArn,
      // AWS Managed KMS Keyを利用する場合は不要
      props.bucketForTarget.encryptionKey.keyArn,
      props.bucketForSource.encryptionKey.keyArn,
      props.bucketForGlueAssest.encryptionKey.keyArn,
    ];
    const glueJobPolicyJSON = {
      Version: '2012-10-17',
      Statement: [
        //データソースS3参照用権限
        {
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          Resource: [`${props.bucketForSource.bucket.bucketArn}/*`],
          Effect: 'Allow',
        },
        //ターゲットS3出力用権限
        {
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          Resource: [`${props.bucketForTarget.bucket.bucketArn}/*`],
          Effect: 'Allow',
        },
        //アセットS3参照用権限
        {
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          Resource: [`${props.bucketForGlueAssest.bucket.bucketArn}/*`],
          Effect: 'Allow',
        },
        //アセットS3出力用権限
        {
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
          Resource: [`${props.bucketForGlueAssest.bucket.bucketArn}/*`],
          Effect: 'Allow',
        },
        //KMS使用権限
        {
          Action: ['kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey', 'kms:Decrypt', 'logs:AssociateKmsKey'],
          Resource: resoucesListForGlueJobKMSPolicy,
          Effect: 'Allow',
        },
      ],
    };

    this.glueIamRole = new IamRole(this, 'glueJobRole', {
      policyStatement: glueJobPolicyJSON,
      servicePrincipal: glueServiceUrl,
    });
    this.glueIamRole.addAwsManagedPolicy(glueManagedPolicy);
    this.glueIamRole.addManagedPolicy;
  }
}
