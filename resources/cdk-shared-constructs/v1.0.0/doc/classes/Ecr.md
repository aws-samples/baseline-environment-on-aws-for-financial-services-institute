[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / Ecr

# Class: Ecr

ECR リポジトリ(Private) を作成する Construct <br>

- SSE-S3(AES256)による暗号化
- タグのイミュータビリティ 有効
  See: [aws-cdk-lib.aws_ecr.Repository](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr.Repository.html)

**`Example`**

ECR リポジトリを作成（脆弱性スキャン結果を snsTopic にメール送信）

```
new Ecr(this, 'EcrRepository', {
  repositoryName: 'EcrRepository',
  alarmTopic: snsTopic
});
```

**`Example`**

ECR リポジトリを作成（脆弱性スキャンは行わない）

```
new Ecr(this, 'EcrRepository', {
  repositoryName: 'EcrRepository',
  imageScanOnPush: false
});
```

**`Example`**

ECR リポジトリを作成（リポジトリ名は自動生成、脆弱性スキャンは行わない, KMS による暗号化）

```
new Ecr(this, 'EcrRepository', {
  imageScanOnPush: false,
  encryption: ecr.RepositoryEncryption.KMS
});
```

## Hierarchy

- `Construct`

  ↳ **`Ecr`**

## Table of contents

### Constructors

- [constructor](Ecr.md#constructor)

### Properties

- [kmsKey](Ecr.md#kmskey)
- [repository](Ecr.md#repository)

## Constructors

### constructor

• **new Ecr**(`scope`, `id`, `props`)

#### Parameters

| Name    | Type                                    |
| :------ | :-------------------------------------- |
| `scope` | `Construct`                             |
| `id`    | `string`                                |
| `props` | [`EcrProps`](../interfaces/EcrProps.md) |

#### Overrides

Construct.constructor

#### Defined in

bleafsi-ecr.ts:80

## Properties

### kmsKey

• `Readonly` **kmsKey**: `IKey`

#### Defined in

bleafsi-ecr.ts:78

---

### repository

• `Readonly` **repository**: `Repository`

#### Defined in

bleafsi-ecr.ts:77
