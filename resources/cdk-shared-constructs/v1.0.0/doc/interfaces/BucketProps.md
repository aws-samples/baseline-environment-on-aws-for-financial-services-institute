[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / BucketProps

# Interface: BucketProps

S3 バケット作成時のパラメータ

## Table of contents

### Properties

- [LifecycleRules](BucketProps.md#lifecyclerules)
- [accessLogsLifecycleRules](BucketProps.md#accesslogslifecyclerules)
- [accessLogsPrefix](BucketProps.md#accesslogsprefix)
- [bucketName](BucketProps.md#bucketname)
- [createAccessLog](BucketProps.md#createaccesslog)
- [denyDeleteObject](BucketProps.md#denydeleteobject)
- [encryption](BucketProps.md#encryption)
- [encryptionKey](BucketProps.md#encryptionkey)
- [removalPolicy](BucketProps.md#removalpolicy)

## Properties

### LifecycleRules

• `Optional` **LifecycleRules**: `LifecycleRule`[]

バケットに指定する S3 ライフサイクルルール。デフォルトは指定なし <br>
See: [CDK v2 aws_s3.LifecycleRule](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.LifecycleRule.html)

**`Example`**

作成後 15 日後に Gracier に移動,作成後 30 日後に削除

```
  [
     {
       enabled: true,
       expiration: cdk.Duration.days(30),
       transitions: [
         {
           transitionAfter: cdk.Duration.days(15),
           storageClass: s3.StorageClass.GLACIER,
         },
       ],
     },
   ]
```

#### Defined in

bleafsi-s3-bucket.ts:62

---

### accessLogsLifecycleRules

• `Optional` **accessLogsLifecycleRules**: `LifecycleRule`[]

アクセスログ用バケットに指定する S3 ライフサイクルルール <br>
See: [CDK v2 aws_s3.LifecycleRule](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.LifecycleRule.html)

**`Default Value`**

- 作成後 90 日後に Gracier に移動
- 作成後 2555 日（7 年後）に削除

#### Defined in

bleafsi-s3-bucket.ts:79

---

### accessLogsPrefix

• `Optional` **accessLogsPrefix**: `string`

アクセスログ保管時のフォルダ名

#### Defined in

bleafsi-s3-bucket.ts:90

---

### bucketName

• `Optional` **bucketName**: `string`

S3 バケットの名前 <br>
[条件]

- AWS 全組織でユニーク
- 小文字 + '-' のみを含む
- 3 文字以上で 63 文字以内

省略した場合は指定したスタック情報から機械的にバケット名が生成される。

#### Defined in

bleafsi-s3-bucket.ts:23

---

### createAccessLog

• `Optional` **createAccessLog**: `boolean`

アクセスログ用のバケットを作成するかどうか。
false が指定された場合は、バケット本体のみを作成する

**`Default Value`**

true

#### Defined in

bleafsi-s3-bucket.ts:70

---

### denyDeleteObject

• `Optional` **denyDeleteObject**: `boolean`

デフォルトは false。true にするとオブジェクトの削除を禁止するバケットポリシーを追加（true はログ保管用のバケットに使用される）

**`Default Value`**

false

#### Defined in

bleafsi-s3-bucket.ts:85

---

### encryption

• `Optional` **encryption**: `BucketEncryption`

S3 バケットの暗号化方式 <br>
See: [CDK v2 aws_s3.BucketEncryption](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.BucketEncryption.html)

- s3.BucketEncryption.S3_MANAGED: SSE-S3
- s3.BucketEncryption.KMS SSE-KMS: SSE-KMS customer managed key
- s3.BucketEncryption.KMS_MANAGED: SSE-KMS aws managed key

**`Default`**

s3.BucketEncryption.S3_MANAGED

#### Defined in

bleafsi-s3-bucket.ts:34

---

### encryptionKey

• `Optional` **encryptionKey**: `IKey`

encryption プロパティで`s3.BucketEncryption.KMS_MANAGED`を指定した場合に使用する KMS キーを指定する <br>
指定されない場合はデフォルトで KMS Key が作成される <br>
See: [CDK v2 aws_kms.IKey](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kms.IKey.html)

#### Defined in

bleafsi-s3-bucket.ts:41

---

### removalPolicy

• `Optional` **removalPolicy**: `RemovalPolicy`

CDK スタックからこのバケットを削除した時の S3 バケットの状態 <br>
See: [CDK v2 aws-cdk-lib.RemovalPolicy](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RemovalPolicy.html)

- cdk.RemovalPolicy.RETAIN: バケットを保持する （デフォルト）
- cdk.RemovalPolicy.DESTROY: 削除する

**`Default Value`**

cdk.RemovalPolicy.RETAIN

#### Defined in

bleafsi-s3-bucket.ts:100
