// based on /resources/cdk-shared-constructs/lib/bleafsi-waf.ts@v1.0.0
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';

/**
 * WAF Web ACL作成時のパラメータ
 */
export interface WafProps {
  /**
   * Web ACL のスコープを指定 <br>
   * CloudFrontの場合のみ 'CLOUDFRONT'を指定、それ以外（ALB、API Gateway,AppSync、Cognito user pool, App Runnber） では REGIONAL' を指定。<br>
   * CloudFrontの場合は WAFv2リソースを us-east-1 にデプロイする必要がある事に注意
   *
   * @defaultValue
   * 'REGIONAL'
   */
  scope?: string;
  /**
   * Web ACL の名前
   */
  name?: string;
  /**
   * 説明
   */
  description?: string;
  /**
   * 追加するマネジードルールセット <br>
   * この属性が空の場合はデフォルトのルールセットが適用される。<br>
   * 各ルールセットのpropery属性にはユニークな値を指定すること
   * See: [aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty.html)
   *
   * @example
   * ```
   * rules: [
   *   Waf.getManagedRuleSet(1, 'AWS', 'AWSManagedRulesCommonRuleSet'),
   *   Waf.getManagedRuleSet(2, 'AWS', 'AWSManagedRulesWindowsRuleSet'),
   * ],
   * ```
   */
  rules?: wafv2.CfnWebACL.RuleProperty[];
}

/**
 * WAF Web ACL を作成する Construct <br>
 * デフォルトでは下記のAWSマネージドルールグループを有効化している。 rulesプロパティにルールセットを指定した場合は、デフォルトのルールは追加されない
 * - コアルールセット [AWSManagedRulesCommonRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-baseline.html)
 * - 既知の不正入力 [AWSManagedRulesKnownBadInputsRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-baseline.html)
 * - IP評価リスト [AWSManagedRulesAmazonIpReputationList](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-ip-rep.html)
 * - Linux OS [AWSManagedRulesLinuxRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-use-case.html#aws-managed-rule-groups-use-case-linux-os)
 * - SQLデータベース [AWSManagedRulesSQLiRuleSet](https://docs.aws.amazon.com/ja_jp/waf/latest/developerguide/aws-managed-rule-groups-use-case.html#aws-managed-rule-groups-use-case-sql-db)
 *
 * See: [aws-cdk-lib.aws_wafv2.CfnWebACL](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnWebACL.html) <br>
 * See: [aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnWebACL.RuleProperty.html)
 *
 * @example
 * ```
 * new Ecr(this, 'MyEcrRepository', {
 *   repositoryName: 'MyEcrRepository',
 *   alarmTopic: snsTopic
 * });
 * ```
 */
export class Waf extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props?: WafProps) {
    super(scope, id);

    //プロパティのデフォルト値設定
    props = props ?? {};
    props.scope = props.scope ?? 'REGIONAL';
    props.name = props.name ?? `${id}`;
    props.description = props.description ?? `Web ACL for ${id}`;

    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {} },
      name: props.name,
      description: props.description,
      scope: props.scope,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${props.name}-WebAcl`,
        sampledRequestsEnabled: true,
      },
      rules: createRules(props),
    });
    this.webAcl = webAcl;
  }

  /**
   * CfnWebACL.RuleProperty を作成する。<br>
   * 下記の形式のオブジェクトを作成
   * ```
   *   {
   *     priority: ${priority},
   *     overrideAction: { count: {} },
   *     visibilityConfig: {
   *       sampledRequestsEnabled: true,
   *       cloudWatchMetricsEnabled: true,
   *       metricName: `${vendor}-${ruleName}`,
   *     },
   *     name: `${ruleName}`,
   *     statement: {
   *       managedRuleGroupStatement: {
   *         vendorName: `${vendor}`,
   *         name: `${ruleName}`,
   *       },
   *     },
   *   },
   * ```
   * @param priority ルールセットの優先順位（ユニークな値）
   * @param vendor ルールの作成元（例 AWS）
   * @param ruleName ルール名
   * @returns wafv2.CfnWebACL.RuleProperty
   */
  static getManagedRuleSet(priority: number, vendor: string, ruleName: string): wafv2.CfnWebACL.RuleProperty {
    return getManagedRuleSet(priority, vendor, ruleName);
  }
}

////////////////
/*
 * Web ACLにセットするルールを定義
 * 下記の5つのマネージドルールに、パラメータで指定されたルールを追加
 * - コアルールセット [AWSManagedRulesCommonRuleSet]
 * - 既知の不正入力 [AWSManagedRulesKnownBadInputsRuleSet]
 * - IP評価リスト [AWSManagedRulesAmazonIpReputationList]
 * - Linux OS [AWSManagedRulesLinuxRuleSet]
 * - SQLデータベース [AWSManagedRulesSQLiRuleSet]
 */
function createRules(props: WafProps): wafv2.CfnWebACL.RuleProperty[] {
  const baseRules: wafv2.CfnWebACL.RuleProperty[] = [];

  //rules属性が空の場合は、デフォルト マネージドルール追加
  if (props.rules == null) {
    baseRules.push(getManagedRuleSet(1, 'AWS', 'AWSManagedRulesCommonRuleSet'));
    baseRules.push(getManagedRuleSet(2, 'AWS', 'AWSManagedRulesKnownBadInputsRuleSet'));
    baseRules.push(getManagedRuleSet(3, 'AWS', 'AWSManagedRulesAmazonIpReputationList'));
    baseRules.push(getManagedRuleSet(4, 'AWS', 'AWSManagedRulesLinuxRuleSet'));
    baseRules.push(getManagedRuleSet(5, 'AWS', 'AWSManagedRulesSQLiRuleSet'));
  } else {
    //ユーザー指定のルールを追加
    for (const rule of props.rules) {
      baseRules.push(rule);
    }
  }

  return baseRules;
}
/*
 * CfnWebACL.RulePropertyを作成する
 */
function getManagedRuleSet(priority: number, vendor: string, ruleName: string): wafv2.CfnWebACL.RuleProperty {
  return {
    priority: priority,
    overrideAction: { count: {} },
    visibilityConfig: {
      sampledRequestsEnabled: true,
      cloudWatchMetricsEnabled: true,
      metricName: `${vendor}-${ruleName}`,
    },
    name: ruleName,
    statement: {
      managedRuleGroupStatement: {
        vendorName: vendor,
        name: ruleName,
      },
    },
  };
}
