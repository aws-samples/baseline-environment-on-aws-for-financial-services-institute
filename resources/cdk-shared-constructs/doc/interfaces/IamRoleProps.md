[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / IamRoleProps

# Interface: IamRoleProps

IAM role 作成時のパラメータ

## Table of contents

### Properties

- [policyStatement](IamRoleProps.md#policystatement)
- [roleName](IamRoleProps.md#rolename)
- [servicePrincipal](IamRoleProps.md#serviceprincipal)

## Properties

### policyStatement

• `Optional` **policyStatement**: `any`

IAM Role に追加するポリシー（JSON 形式）。マネージドポリシーとして作成される

**`Example`**

```
policyStatement: {
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
    }
   ],
 }
```

#### Defined in

bleafsi-iam-role.ts:33

---

### roleName

• `Optional` **roleName**: `string`

IAM Role の名前

#### Defined in

bleafsi-iam-role.ts:58

---

### servicePrincipal

• `Optional` **servicePrincipal**: `string`

IAM Role の[信頼関係]に設定する Service Principal <br>
以下の`Pricipal - Service` に設定する値

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "xxxx"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**`Default Value`**

'ec2.amazonaws.com'

#### Defined in

bleafsi-iam-role.ts:54
