[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / EcrProps

# Interface: EcrProps

ECR リポジトリ作成時のパラメータ

## Table of contents

### Properties

- [alarmTopic](EcrProps.md#alarmtopic)
- [encryption](EcrProps.md#encryption)
- [imageScanOnPush](EcrProps.md#imagescanonpush)
- [repositoryName](EcrProps.md#repositoryname)

## Properties

### alarmTopic

• `Optional` **alarmTopic**: `Topic`

イメージ Push 時の脆弱性スキャンの結果を送付する SNS Topic <br>
See: [aws-cdk-lib.aws_sns.Topic](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_sns.Topic.html)

#### Defined in

bleafsi-ecr.ts:24

---

### encryption

• `Optional` **encryption**: `RepositoryEncryption`

リポジトリの暗号化を有効化する場合は下記のいずれかを指定する。KMS を指定した場合は自動的に KMS Key が生成される。<br>

- KMS: KMS Key による暗号化
- AES_256: SSE-S3 方式の暗号化

**`Example`**

KMS による暗号化

```
  encryption: ecr.RepositoryEncryption.KMS
```

**`Default Value`**

AES256

#### Defined in

bleafsi-ecr.ts:44

---

### imageScanOnPush

• `Optional` **imageScanOnPush**: `boolean`

イメージ Push 時に脆弱性スキャンを実行する

**`Default Value`**

true

#### Defined in

bleafsi-ecr.ts:32

---

### repositoryName

• `Optional` **repositoryName**: `string`

ECR リポジトリの名前 <br>
次の文字のみで構成すること。[a-z0-9._-]

#### Defined in

bleafsi-ecr.ts:19
