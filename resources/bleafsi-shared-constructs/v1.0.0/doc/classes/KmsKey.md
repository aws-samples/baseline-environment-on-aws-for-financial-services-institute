[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / KmsKey

# Class: KmsKey

KMS Key を作成する Construct <br>
See: [aws-cdk-lib.aws_kms.Key](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_kms.Key.html)

**`Example`**

デフォルト設定で Key を作成

```
import { KmsKey } from '../lib/bleafsi-kms-key';

const kmskey = new KmsKey(this, 'S3Encryption');
```

**`Example`**

alias と description を指定して作成

```
import { KmsKey } from '../lib/bleafsi-kms-key';

const kmskey = new KmsKey(this, 'CloudTrailEncryption', {
  alias : 'alias/cloudtrail',
  description : 'this key is used for encryption of CloudTrail trail'
})
```

## Hierarchy

- `Construct`

  ↳ **`KmsKey`**

## Table of contents

### Constructors

- [constructor](KmsKey.md#constructor)

### Properties

- [key](KmsKey.md#key)

### Methods

- [addToResourcePolicy](KmsKey.md#addtoresourcepolicy)

## Constructors

### constructor

• **new KmsKey**(`scope`, `id`, `props?`)

#### Parameters

| Name     | Type                                          |
| :------- | :-------------------------------------------- |
| `scope`  | `Construct`                                   |
| `id`     | `string`                                      |
| `props?` | [`KmsKeyProps`](../interfaces/KmsKeyProps.md) |

#### Overrides

Construct.constructor

#### Defined in

bleafsi-kms-key.ts:57

## Properties

### key

• `Readonly` **key**: `IKey`

作成された KMS Key

#### Defined in

bleafsi-kms-key.ts:56

## Methods

### addToResourcePolicy

▸ **addToResourcePolicy**(`policy`): `void`

KMS Key にリソースポリシーを追加する

**`Example`**

```
kmsKey.addToResourcePolicy(
  new iam.PolicyStatement({
    actions: ['kms:GenerateDataKey*'],
    principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
    resources: ['*'],
    conditions: {
      StringLike: {
        'kms:EncryptionContext:aws:cloudtrail:arn': [`arn:aws:cloudtrail:*:${cdk.Stack.of(this).account}:trail/*`],
      },
    },
  }),
);
```

#### Parameters

| Name     | Type              | Description                                                                                                                                              |
| :------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `policy` | `PolicyStatement` | 追加する IAM ポリシーステートメント See: [aws_iam.PolicyStatement](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.PolicyStatement.html) |

#### Returns

`void`

#### Defined in

bleafsi-kms-key.ts:97
