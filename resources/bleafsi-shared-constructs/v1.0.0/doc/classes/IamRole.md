[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / IamRole

# Class: IamRole

IAM role を作成する Construct <br>
See: [aws-cdk-lib.aws_iam.Role](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.Role.html)

**`Example`**

ポリシーを指定して IAM role を作成

```
 const policyStatement = {
   Version: '2012-10-17',
   Statement: [
     {
       Resource: '*',
       Effect: 'Allow',
       NotAction: 'iam:*',
     },
     {
       Action: 'aws-portal:*Billing',
       Resource: '*',
       Effect: 'Deny',
     },
   ],
 };
 const iamRole1 = new IamRole(this, 'IamRole1', {
   policyStatement: policyStatement,
 });
```

**`Example`**

roleName, ServicePrincipal を指定

```
 const iamRole = new IamRole(this, 'IamRole', {
   roleName: 'bleafsi-shared-role'
   policyStatement: policyStatement,
   servicePrincipal: 'cloudtrail.amazonaws.com',
 });
```

## Hierarchy

- `Construct`

  ↳ **`IamRole`**

## Table of contents

### Constructors

- [constructor](IamRole.md#constructor)

### Properties

- [iamRole](IamRole.md#iamrole)
- [managedPolicies](IamRole.md#managedpolicies)

### Methods

- [addAwsManagedPolicy](IamRole.md#addawsmanagedpolicy)
- [addManagedPolicy](IamRole.md#addmanagedpolicy)
- [addPolicy](IamRole.md#addpolicy)

## Constructors

### constructor

• **new IamRole**(`scope`, `id`, `props?`)

#### Parameters

| Name     | Type                                            |
| :------- | :---------------------------------------------- |
| `scope`  | `Construct`                                     |
| `id`     | `string`                                        |
| `props?` | [`IamRoleProps`](../interfaces/IamRoleProps.md) |

#### Overrides

Construct.constructor

#### Defined in

bleafsi-iam-role.ts:106

## Properties

### iamRole

• `Readonly` **iamRole**: `Role`

作成された IAM Role

#### Defined in

bleafsi-iam-role.ts:100

---

### managedPolicies

• `Readonly` **managedPolicies**: `IManagedPolicy`[]

設定された custom managed policy

#### Defined in

bleafsi-iam-role.ts:104

## Methods

### addAwsManagedPolicy

▸ **addAwsManagedPolicy**(`managedPolicyName`): `void`

AWS Managed Policy を追加する

**`Example`**

```
const iamRole = new IamRole(this, 'IamRole', {
  policyStatement: policyStatement,
});
iamRole.addAwsManagedPolicy('AWSLambdaExecute');
```

#### Parameters

| Name                | Type     | Description              |
| :------------------ | :------- | :----------------------- |
| `managedPolicyName` | `string` | AWS のマネージドルール名 |

#### Returns

`void`

#### Defined in

bleafsi-iam-role.ts:152

---

### addManagedPolicy

▸ **addManagedPolicy**(`managedPolicyName`): `void`

既存の Custom Managed Policy を追加する

**`Example`**

```
 //IAMロール作成
 const iamRole = new IamRole(this, 'IamRole', {
  policyStatement: policyStatement,
 });
 iamRole.addManagedPolicy(managedPolicyName);
```

#### Parameters

| Name                | Type     | Description                    |
| :------------------ | :------- | :----------------------------- |
| `managedPolicyName` | `string` | 既存のマネージドポリシーの名前 |

#### Returns

`void`

#### Defined in

bleafsi-iam-role.ts:193

---

### addPolicy

▸ **addPolicy**(`policyStatement`, `policyName`): `void`

Policy を追加する

**`Example`**

```
 const policyStatement = {
   xxxxx
 }
 //IAMロール作成
 const iamRole = new IamRole(this, 'IamRole', {});
 iamRole.addManagedPolicy(policyStatement, 'bleafsi-shared-policy');
```

#### Parameters

| Name              | Type     | Description                                                            |
| :---------------- | :------- | :--------------------------------------------------------------------- |
| `policyStatement` | `any`    | ポリシーステートメント                                                 |
| `policyName`      | `string` | 追加するポリシーに付ける名前（アカウント内でユニークな名前とすること） |

#### Returns

`void`

#### Defined in

bleafsi-iam-role.ts:171
