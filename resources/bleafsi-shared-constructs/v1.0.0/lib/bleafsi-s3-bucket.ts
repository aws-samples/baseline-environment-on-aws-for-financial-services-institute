/*
 * @version 1.0
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_kms as kms } from 'aws-cdk-lib';

/**
 * S3バケット作成時のパラメータ
 */
export interface BucketProps {
  /**
   * S3バケットの名前 <br>
   * [条件]
   * - AWS全組織でユニーク
   * - 小文字 + '-' のみを含む
   * - 3文字以上で63文字以内
   *
   * 省略した場合は指定したスタック情報から機械的にバケット名が生成される。
   */
  bucketName?: string;

  /**
   * S3バケットの暗号化方式 <br>
   * See: [CDK v2 aws_s3.BucketEncryption](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.BucketEncryption.html)
   *   - s3.BucketEncryption.S3_MANAGED:  SSE-S3
   *   - s3.BucketEncryption.KMS SSE-KMS: SSE-KMS customer managed key
   *   - s3.BucketEncryption.KMS_MANAGED: SSE-KMS aws managed key
   * @default
   * s3.BucketEncryption.S3_MANAGED
   */
  encryption?: s3.BucketEncryption;

  /**
   * encryptionプロパティで`s3.BucketEncryption.KMS_MANAGED`を指定した場合に使用するKMSキーを指定する <br>
   * 指定されない場合はデフォルトでKMS Keyが作成される <br>
   * See: [CDK v2 aws_kms.IKey](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kms.IKey.html)
   */
  encryptionKey?: kms.IKey;

  /**
   *  バケットに指定するS3ライフサイクルルール。デフォルトは指定なし <br>
   *  See: [CDK v2 aws_s3.LifecycleRule](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.LifecycleRule.html)
   *  @example 作成後15日後に Gracierに移動,作成後 30日後に削除
   *  ```
   *    [
   *       {
   *         enabled: true,
   *         expiration: cdk.Duration.days(30),
   *         transitions: [
   *           {
   *             transitionAfter: cdk.Duration.days(15),
   *             storageClass: s3.StorageClass.GLACIER,
   *           },
   *         ],
   *       },
   *     ]
   * ```
   */
  LifecycleRules?: s3.LifecycleRule[];

  /**
   * アクセスログ用のバケットを作成するかどうか。
   * falseが指定された場合は、バケット本体のみを作成する
   * @defaultValue
   * true
   */
  createAccessLog?: boolean;

  /**
   * アクセスログ用バケットに指定するS3ライフサイクルルール <br>
   * See: [CDK v2 aws_s3.LifecycleRule](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.LifecycleRule.html)
   *  @defaultValue
   *  - 作成後90日後に Gracierに移動
   *  - 作成後2555日（7年後）に削除
   */
  accessLogsLifecycleRules?: s3.LifecycleRule[];

  /**
   *  デフォルトはfalse。true にするとオブジェクトの削除を禁止するバケットポリシーを追加（trueはログ保管用のバケットに使用される）
   *  @defaultValue false
   */
  denyDeleteObject?: boolean;

  /**
   *  アクセスログ保管時のフォルダ名
   */
  accessLogsPrefix?: string;

  /**
   *  CDKスタックからこのバケットを削除した時のS3バケットの状態 <br>
   *  See: [CDK v2 aws-cdk-lib.RemovalPolicy](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RemovalPolicy.html)
   *    - cdk.RemovalPolicy.RETAIN: バケットを保持する （デフォルト）
   *    - cdk.RemovalPolicy.DESTROY: 削除する
   *
   *  @defaultValue cdk.RemovalPolicy.RETAIN
   */
  removalPolicy?: cdk.RemovalPolicy;
}

/**
 * S3バケットを作成するConstruct <br>
 * See: [CDK v2 aws_s3.encryption](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.Bucket.html#encryption)
 *
 * @remarks
 * <img src="../media/Bucket.png">
 *
 * 下記設定の2つのバケットを作成する
 * - バケット本体
 *   - Publicアクセスブロック：有効
 *   - バージョン管理: 有効
 *   - 暗号化：SSE-S3
 *   - HTTPSアクセスのみ許可
 * - アクセスログ用バケット（オプションにより作成しないことも可）
 *   - Publicアクセスブロック：有効
 *   - バージョン管理: 有効
 *   - 暗号化：SSE-S3
 *   - HTTPSアクセスのみ許可
 *   - オブジェクトの削除は禁止
 *   - ライフサイクルルール
 *    - 作成後90日後に Gracierに移動
 *    - 作成後2555日（7年後）に削除
 *
 * @example パラメータは全てデフォルト、暗号化鍵は SSE-S3 を使用
 * ```
 *  import { Bucket } from '../lib/bleafsi-s3-bucket';
 *
 *  const bucket = new Bucket(this, 'sampleBucket');
 *
 *  const s3_bucket = bucket.bucket;  //バケット本体
 *  const accesslog_bucket = bucket.accessLogbucket; //アクセスログバケット
 * ```
 * @example CDKスタック削除時にバケットを削除、暗号化鍵は SSE-S3 を使用、バケット名指定、アクセスログは作成しない
 * ```
 *  import { Bucket } from '../lib/bleafsi-s3-bucket';
 *
 *  const bucket = new Bucket(this, 'sampleBucket', {
 *    bucketName: `${PjPrefix.toLowerCase()}-xxx-${cdk.Stack.of(this).account}`,
 *    removalPolicy: cdk.RemovalPolicy.DESTROY,
 *    createAccessLog: false,
 *  });
 * ```
 * @example 暗号化鍵として KMS SSE-KMS aws managed key を使用
 * ```
 *  const bucket = new Bucket(this, 'sampleBucket', {
 *    encryption: s3.BucketEncryption.KMS_MANAGED,
 *  });
 * ```
 * @example 暗号化鍵として KMS SSE-KMS customer managed key を使用
 * ```
 *  const bucket = new Bucket(this, 'sampleBucket', {
 *    encryption: s3.BucketEncryption.KMS,
 *  });
 *  //生成されたKMS Keyを取得
 *  const kmskey = bucket.encryptionKey;
 * ```
 * @example 暗号化鍵として KMS SSE-KMS customer managed key を使用。明示的に key を指定
 * ```
 *  const kmskey = new KmsKey(this, 'S3Encryption');
 *  const bucket = new Bucket(this, 'sampleBucket', {
 *    encryption: s3.BucketEncryption.KMS,
 *    encryptionKey: kmskey.key,
 *  });
 * ```
 */
export class Bucket extends Construct {
  /**
   * 生成したバケット本体
   */
  readonly bucket: s3.Bucket;
  /**
   * 生成したバケット本体に対するアクセスログ用バケット
   */
  readonly accessLogbucket: s3.Bucket;
  /**
   * バケット本体の暗号化にKMSを使用する場合の暗号化キー
   */
  readonly encryptionKey: kms.IKey;

  constructor(scope: Construct, id: string, props?: BucketProps) {
    super(scope, id);

    //プロパティのデフォルト値設定
    props = props ?? {};
    props.removalPolicy = props.removalPolicy ?? cdk.RemovalPolicy.RETAIN;
    props.createAccessLog = props.createAccessLog ?? true;

    if (props.encryption == null) {
      props.encryption = s3.BucketEncryption.S3_MANAGED; //default
    } else if (
      props.encryption == s3.BucketEncryption.KMS_MANAGED ||
      props.encryption == s3.BucketEncryption.S3_MANAGED
    ) {
      //何もしない
    } else {
      //KMSの場合
      if (props.encryption == s3.BucketEncryption.KMS) {
        if (props.encryptionKey == null) {
          //encryption keyの指定がない場合は、S3 暗号化用のKMSキーを作成
          this.encryptionKey = new kms.Key(this, 'Key', {
            enableKeyRotation: true,
            description: 'for S3 Encryption',
            alias: `${id}-for-s3-encryption`,
          });
          props.encryptionKey = this.encryptionKey;
        } else {
          this.encryptionKey = props.encryptionKey;
        }
      }
    }

    if (props.accessLogsLifecycleRules == null) {
      props.accessLogsLifecycleRules = [
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
      ];
    }

    //1 バケット作成
    let bucketProps: s3.BucketProps;

    //プロパティの指定
    if (props.encryption != s3.BucketEncryption.KMS) {
      //encryption == KMS 以外では encryptionKey 属性は指定しない（指定するとエラーになる）
      bucketProps = {
        accessControl: s3.BucketAccessControl.PRIVATE,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        versioned: true,
        encryption: props.encryption,
        removalPolicy: props.removalPolicy,
        enforceSSL: true,
      };
    } else {
      //encryption == KMS では encryptionKey 属性を指定する
      bucketProps = {
        accessControl: s3.BucketAccessControl.PRIVATE,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        versioned: true,
        encryption: props.encryption,
        encryptionKey: props.encryptionKey, //違いはここだけ
        removalPolicy: props.removalPolicy,
        enforceSSL: true,
      };
    }

    //bucket nameの指定
    if (props.bucketName != null) {
      bucketProps = { ...bucketProps, bucketName: props.bucketName };
    }

    //removalPolicy が DESTROYの場合は autoDeleteObjects もtrueにする
    if (props.removalPolicy == cdk.RemovalPolicy.DESTROY) {
      bucketProps = { ...bucketProps, autoDeleteObjects: true };
    }

    //アクセスログ バケットの作成
    if (props.createAccessLog) {
      const accessLogsBucket = new AccessLogsBucket(this, 'AccessLogs', props);
      bucketProps = {
        ...bucketProps,
        serverAccessLogsBucket: accessLogsBucket.bucket,
        serverAccessLogsPrefix: props.accessLogsPrefix,
      };
      this.accessLogbucket = accessLogsBucket.bucket;
    }

    //S3 Bucket
    const bucket = new s3.Bucket(this, 'Default', bucketProps);

    //ライフサイクルルールが指定されている場合はセット
    if (props.LifecycleRules != null) {
      for (const rule of props.LifecycleRules) {
        bucket.addLifecycleRule(rule);
      }
    }
    //オブジェクトの削除を禁止するポリシー追加
    if (props.denyDeleteObject) {
      bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          sid: 'Restrict Delete* Actions',
          effect: iam.Effect.DENY,
          actions: ['s3:DeleteObject'],
          principals: [new iam.AnyPrincipal()],
          resources: [bucket.arnForObjects('*')],
        }),
      );
    }

    this.bucket = bucket;
  }

  /**
   * バケットにリソースポリシーを追加する
   *
   * @param policy - 追加するIAMポリシーステートメント See: [aws_iam.PolicyStatement](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.PolicyStatement.html)
   *
   * @example
   * ```
   * const policy = new iam.PolicyStatement({
   *   sid: 'AWSBucketDelivery',
   *   effect: iam.Effect.ALLOW,
   *   resources: [`${bucket.bucketArn}/ * / *`],
   *   principals: [
   *     new iam.ServicePrincipal('cloudtrail.amazonaws.com'),
   *     new iam.ServicePrincipal('config.amazonaws.com'),
   *   ],
   *   actions: ['s3:PutObject'],
   *   conditions: {
   *     StringEquals: {
   *       's3:x-amz-acl': 'bucket-owner-full-control',
   *     },
   *   },
   * });
   *
   * bucket.addToResourcePolicy(policy);
   * ```
   */
  addToResourcePolicy(policy: iam.PolicyStatement): void {
    this.bucket.addToResourcePolicy(policy);
  }
}

/*
 * アクセスログ用のバケット作成
 */
class AccessLogsBucket extends Construct {
  readonly bucket: s3.Bucket;
  constructor(scope: Construct, id: string, props: BucketProps) {
    super(scope, id);

    let bucketProps: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: props.removalPolicy,
      enforceSSL: true,
      lifecycleRules: props.accessLogsLifecycleRules,
    };

    //bucket nameの指定
    if (props.bucketName != null) {
      bucketProps = { ...bucketProps, bucketName: props.bucketName + '-logs' };
    }

    //removalPolicy が DESTROYの場合は autoDeleteObjects もtrueにする
    if (props.removalPolicy == cdk.RemovalPolicy.DESTROY) {
      bucketProps = { ...bucketProps, autoDeleteObjects: true };
    }
    const bucket = new s3.Bucket(this, 'Default', bucketProps);

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
