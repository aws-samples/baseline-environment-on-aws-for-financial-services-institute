import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { Ecr } from '../lib/bleafsi-ecr';
import { KmsKey } from '../lib/bleafsi-kms-key';

/*
 * このサブプロジェクトのlib配下に作成した ECR Construct をテストするためのStack
 */

export class EcrStack extends cdk.Stack {
  readonly ecr: Ecr[];
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.ecr = [];

    //イメージスキャンを行わない、SSE-S3（AES256）による暗号化
    const ecr1 = new Ecr(this, 'EcrRepository1', {
      repositoryName: 'ecr-repository1',
      imageScanOnPush: false,
    });
    this.ecr.push(ecr1);

    //イメージスキャンを実施, KMSによる暗号化、リポジトリ名は自動生成
    const kmsKey = new KmsKey(this, `${id}-SNS-Topic-Key`);
    const topic = new sns.Topic(this, 'Default', {
      masterKey: kmsKey.key,
    });
    const ecr2 = new Ecr(this, 'EcrRepository2', {
      alarmTopic: topic,
      encryption: ecr.RepositoryEncryption.KMS,
    });
    this.ecr.push(ecr2);

    //CFn output
    new cdk.CfnOutput(this, 'ECR repository name1', {
      value: ecr1.repository.repositoryName,
    });
    new cdk.CfnOutput(this, 'ECR repository name2', {
      value: ecr2.repository.repositoryName,
    });
  }
}
