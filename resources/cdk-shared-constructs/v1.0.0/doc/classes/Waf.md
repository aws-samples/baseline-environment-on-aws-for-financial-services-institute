[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / Waf

# Class: Waf

WAF Web ACL を作成する Construct <br>
デフォルトでは下記の AWS マネージドルールグループを有効化している。 rules プロパティにルールセットを指定した場合は、デフォルトのルールは追加されない

- コアルールセット [AWSManagedRulesCommonRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-baseline.html)
- 既知の不正入力 [AWSManagedRulesKnownBadInputsRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-baseline.html)
- IP 評価リスト [AWSManagedRulesAmazonIpReputationList](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-ip-rep.html)
- Linux OS [AWSManagedRulesLinuxRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-use-case.html#aws-managed-rule-groups-use-case-linux-os)
- SQL データベース [AWSManagedRulesSQLiRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-use-case.html#aws-managed-rule-groups-use-case-sql-db)

See: [aws-cdk-lib.aws_wafv2.CfnWebACL](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnWebACL.html) <br>
See: [aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty.html)

**`Example`**

```
new Ecr(this, 'MyEcrRepository', {
  repositoryName: 'MyEcrRepository',
  alarmTopic: snsTopic
});
```

## Hierarchy

- `Construct`

  ↳ **`Waf`**

## Table of contents

### Constructors

- [constructor](Waf.md#constructor)

### Properties

- [webAcl](Waf.md#webacl)

### Methods

- [getManagedRuleSet](Waf.md#getmanagedruleset)

## Constructors

### constructor

• **new Waf**(`scope`, `id`, `props?`)

#### Parameters

| Name     | Type                                    |
| :------- | :-------------------------------------- |
| `scope`  | `Construct`                             |
| `id`     | `string`                                |
| `props?` | [`WafProps`](../interfaces/WafProps.md) |

#### Overrides

Construct.constructor

#### Defined in

bleafsi-waf.ts:69

## Properties

### webAcl

• `Readonly` **webAcl**: `CfnWebACL`

#### Defined in

bleafsi-waf.ts:67

## Methods

### getManagedRuleSet

▸ `Static` **getManagedRuleSet**(`priority`, `vendor`, `ruleName`): `RuleProperty`

CfnWebACL.RuleProperty を作成する。<br>
下記の形式のオブジェクトを作成

```
  {
    priority: ${priority},
    overrideAction: { count: {} },
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: `${vendor}-${ruleName}`,
    },
    name: `${ruleName}`,
    statement: {
      managedRuleGroupStatement: {
        vendorName: `${vendor}`,
        name: `${ruleName}`,
      },
    },
  },
```

#### Parameters

| Name       | Type     | Description                            |
| :--------- | :------- | :------------------------------------- |
| `priority` | `number` | ルールセットの優先順位（ユニークな値） |
| `vendor`   | `string` | ルールの作成元（例 AWS）               |
| `ruleName` | `string` | ルール名                               |

#### Returns

`RuleProperty`

wafv2.CfnWebACL.RuleProperty

#### Defined in

bleafsi-waf.ts:119
