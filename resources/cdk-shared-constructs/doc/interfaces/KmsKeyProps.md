[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / KmsKeyProps

# Interface: KmsKeyProps

KMS Key 作成時のパラメータ

## Table of contents

### Properties

- [alias](KmsKeyProps.md#alias)
- [description](KmsKeyProps.md#description)
- [enableKeyRotation](KmsKeyProps.md#enablekeyrotation)

## Properties

### alias

• `Optional` **alias**: `string`

KMS Key の alias

**`Remarks`**

アルファベット大文字・小文字 、数字、/\_- のみ使用可

#### Defined in

bleafsi-kms-key.ts:18

---

### description

• `Optional` **description**: `string`

KMS Key の説明

#### Defined in

bleafsi-kms-key.ts:22

---

### enableKeyRotation

• `Optional` **enableKeyRotation**: `boolean`

true にすると自動ローテーション（年次）が有効になる

**`Default Value`**

true

#### Defined in

bleafsi-kms-key.ts:28
