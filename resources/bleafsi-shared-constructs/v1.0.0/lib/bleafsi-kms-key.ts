/*
 * @version 1.0
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_kms as kms } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';

/**
 * KMS Key作成時のパラメータ
 */
export interface KmsKeyProps {
  /**
   * KMS Keyのalias
   * @remarks
   * アルファベット大文字・小文字 、数字、/_- のみ使用可
   */
  alias?: string;
  /**
   * KMS Keyの説明
   */
  description?: string;
  /**
   * true にすると自動ローテーション（年次）が有効になる
   * @defaultValue
   * true
   */
  enableKeyRotation?: boolean;
}

/**
 * KMS Key を作成する Construct <br>
 * See: [aws-cdk-lib.aws_kms.Key](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kms.Key.html)
 *
 * @example デフォルト設定でKeyを作成
 * ```
 * import { KmsKey } from '../lib/bleafsi-kms-key';
 *
 * const kmskey = new KmsKey(this, 'S3Encryption');
 * ```
 *
 * @example alias と descriptionを指定して作成
 * ```
 * import { KmsKey } from '../lib/bleafsi-kms-key';
 *
 * const kmskey = new KmsKey(this, 'CloudTrailEncryption', {
 *   alias : 'alias/cloudtrail',
 *   description : 'this key is used for encryption of CloudTrail trail'
 * })
 * ```
 */
export class KmsKey extends Construct {
  /**
   * 作成された KMS Key
   */
  readonly key: kms.IKey;
  constructor(scope: Construct, id: string, props?: KmsKeyProps) {
    super(scope, id);

    //プロパティのデフォルト値設定
    props = props ?? {};
    props.description = props.description ?? `for ${id}`;
    props.enableKeyRotation = props.enableKeyRotation ?? true;

    let parameters: any = {
      enableKeyRotation: props.enableKeyRotation,
      description: props.description,
    };

    if (props.alias != null) {
      parameters = {
        ...parameters,
        alias: props.alias,
      };
    }
    //KMS Key
    const kmsKey = new kms.Key(this, 'Key', parameters);

    this.key = kmsKey;
  }

  /**
   * KMS Keyにリソースポリシーを追加する
   *
   * @param policy - 追加するIAMポリシーステートメント See: [aws_iam.PolicyStatement](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.PolicyStatement.html)
   *
   * @example
   * ```
   * kmsKey.addToResourcePolicy(
   *   new iam.PolicyStatement({
   *     actions: ['kms:GenerateDataKey*'],
   *     principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
   *     resources: ['*'],
   *     conditions: {
   *       StringLike: {
   *         'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(this).account}:trail/*`],
   *       },
   *     },
   *   }),
   * );
   * ```
   */
  addToResourcePolicy(policy: iam.PolicyStatement): void {
    this.key.addToResourcePolicy(policy);
  }
}
