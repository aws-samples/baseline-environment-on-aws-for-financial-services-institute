/*
 * @version 1.0
 */
import { Construct } from 'constructs';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_events_targets as eventtarget } from 'aws-cdk-lib';
import { KmsKey } from './bleafsi-kms-key';
import { aws_kms as kms } from 'aws-cdk-lib';

/**
 * ECRリポジトリ作成時のパラメータ
 */
export interface EcrProps {
  /**
   * ECRリポジトリの名前 <br>
   * 次の文字のみで構成すること。[a-z0-9._-]
   */
  repositoryName?: string;
  /**
   * イメージPush時の脆弱性スキャンの結果を送付するSNS Topic <br>
   *  See: [aws-cdk-lib.aws_sns.Topic](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sns.Topic.html)
   */
  alarmTopic?: sns.Topic;

  /**
   * イメージPush時に脆弱性スキャンを実行する
   *
   * @defaultValue
   * true
   */
  imageScanOnPush?: boolean;
  /**
   * リポジトリの暗号化を有効化する場合は下記のいずれかを指定する。KMSを指定した場合は自動的にKMS Keyが生成される。<br>
   * - KMS: KMS Keyによる暗号化
   * - AES_256: SSE-S3方式の暗号化
   * @example KMS による暗号化
   * ```
   *   encryption: ecr.RepositoryEncryption.KMS
   * ```
   * @defaultValue
   * AES256
   */
  encryption?: ecr.RepositoryEncryption;
}

/**
 * ECRリポジトリ(Private) を作成する Construct <br>
 * - SSE-S3(AES256)による暗号化
 * - タグのイミュータビリティ 有効
 * See: [aws-cdk-lib.aws_ecr.Repository](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.Repository.html)
 *
 * @example ECRリポジトリを作成（脆弱性スキャン結果を snsTopicにメール送信）
 * ```
 * new Ecr(this, 'EcrRepository', {
 *   repositoryName: 'EcrRepository',
 *   alarmTopic: snsTopic
 * });
 * ```
 *
 * @example ECRリポジトリを作成（脆弱性スキャンは行わない）
 * ```
 * new Ecr(this, 'EcrRepository', {
 *   repositoryName: 'EcrRepository',
 *   imageScanOnPush: false
 * });
 * ```
 * @example ECRリポジトリを作成（リポジトリ名は自動生成、脆弱性スキャンは行わない, KMSによる暗号化）
 * ```
 * new Ecr(this, 'EcrRepository', {
 *   imageScanOnPush: false,
 *   encryption: ecr.RepositoryEncryption.KMS
 * });
 * ```
 */
export class Ecr extends Construct {
  public readonly repository: ecr.Repository;
  public readonly kmsKey: kms.IKey;

  constructor(scope: Construct, id: string, props: EcrProps) {
    super(scope, id);

    //プロパティのデフォルト値設定
    props = props ?? {};
    props.imageScanOnPush = props.imageScanOnPush ?? true;
    props.encryption = props.encryption ?? ecr.RepositoryEncryption.AES_256;

    // Create a repository
    let repositoryProps: ecr.RepositoryProps;
    if (props.encryption == ecr.RepositoryEncryption.KMS) {
      //KMS Keyによる暗号化
      const kmsKey = new KmsKey(this, `${id}-EcrKey`);
      this.kmsKey = kmsKey.key;
      repositoryProps = {
        ...props,
        encryptionKey: this.kmsKey,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
      };
    } else {
      //SSE-S3による暗号化
      repositoryProps = {
        ...props,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
      };
    }
    this.repository = new ecr.Repository(this, 'Default', repositoryProps);

    //イメージPush時に脆弱性スキャン結果をTopicに送信
    if (props.imageScanOnPush && props.alarmTopic != null) {
      const target = new eventtarget.SnsTopic(props.alarmTopic);
      this.repository.onImageScanCompleted('ImageScanComplete').addTarget(target);
    }
  }
}
