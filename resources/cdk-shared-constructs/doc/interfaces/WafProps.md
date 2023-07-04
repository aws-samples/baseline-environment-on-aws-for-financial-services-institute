[BLEA for FSI 共通 L3 コンストラクト サンプル集](../README.md) / [Exports](../modules.md) / WafProps

# Interface: WafProps

WAF Web ACL 作成時のパラメータ

## Table of contents

### Properties

- [description](WafProps.md#description)
- [name](WafProps.md#name)
- [rules](WafProps.md#rules)
- [scope](WafProps.md#scope)

## Properties

### description

• `Optional` **description**: `string`

説明

#### Defined in

bleafsi-waf.ts:28

---

### name

• `Optional` **name**: `string`

Web ACL の名前

#### Defined in

bleafsi-waf.ts:24

---

### rules

• `Optional` **rules**: `RuleProperty`[]

追加するマネジードルールセット <br>
この属性が空の場合はデフォルトのルールセットが適用される。<br>
各ルールセットの propery 属性にはユニークな値を指定すること
See: [aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty.html)

**`Example`**

```
rules: [
  Waf.getManagedRuleSet(1, 'AWS', 'AWSManagedRulesCommonRuleSet'),
  Waf.getManagedRuleSet(2, 'AWS', 'AWSManagedRulesWindowsRuleSet'),
],
```

#### Defined in

bleafsi-waf.ts:43

---

### scope

• `Optional` **scope**: `string`

Web ACL のスコープを指定 <br>
CloudFront の場合のみ 'CLOUDFRONT'を指定、それ以外（ALB、API Gateway,AppSync、Cognito user pool, App Runnber） では REGIONAL' を指定。<br>
CloudFront の場合は WAFv2 リソースを us-east-1 にデプロイする必要がある事に注意

**`Default Value`**

'REGIONAL'

#### Defined in

bleafsi-waf.ts:20
