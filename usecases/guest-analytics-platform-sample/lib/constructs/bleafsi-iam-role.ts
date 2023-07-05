// based on /resources/cdk-shared-constructs/lib/bleafsi-iam-role.ts@v1.0.0

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';

/**
 * IAM role作成時のパラメータ
 */
export interface IamRoleProps {
  /**
   * IAM Roleに追加するポリシー（JSON形式）。マネージドポリシーとして作成される
   * @example
   * ```
   * policyStatement: {
   *   Version: '2012-10-17',
   *   Statement: [
   *     {
   *       Resource: '*',
   *       Effect: 'Allow',
   *       NotAction: 'iam:*',
   *     },
   *     {
   *       Action: 'aws-portal:*Billing',
   *       Resource: '*',
   *       Effect: 'Deny',
   *     }
   *    ],
   *  }
   * ```
   */
  policyStatement?: any;
  /**
   * IAM Roleの[信頼関係]に設定する Service Principal <br>
   * 以下の`Pricipal - Service` に設定する値
   * ```
   * {
   *   "Version": "2012-10-17",
   *   "Statement": [
   *     {
   *       "Effect": "Allow",
   *       "Principal": {
   *         "Service": "xxxx"
   *       },
   *       "Action": "sts:AssumeRole"
   *     }
   *   ]
   * }
   * ```
   * @defaultValue
   * 'ec2.amazonaws.com'
   */
  servicePrincipal?: string;
  /**
   * IAM Roleの名前
   */
  roleName?: string;
}

/**
 * IAM role を作成する Construct <br>
 * See: [aws-cdk-lib.aws_iam.Role](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.Role.html)
 *
 * @example ポリシーを指定してIAM roleを作成
 * ```
 *  const policyStatement = {
 *    Version: '2012-10-17',
 *    Statement: [
 *      {
 *        Resource: '*',
 *        Effect: 'Allow',
 *        NotAction: 'iam:*',
 *      },
 *      {
 *        Action: 'aws-portal:*Billing',
 *        Resource: '*',
 *        Effect: 'Deny',
 *      },
 *    ],
 *  };
 *  const iamRole1 = new IamRole(this, 'IamRole1', {
 *    policyStatement: policyStatement,
 *  });
 * ```
 *
 * @example  roleName, ServicePrincipalを指定
 * ```
 *  const iamRole = new IamRole(this, 'IamRole', {
 *    roleName: 'bleafsi-shared-role'
 *    policyStatement: policyStatement,
 *    servicePrincipal: 'cloudtrail.amazonaws.com',
 *  });
 * ```
 */
export class IamRole extends Construct {
  /**
   * 作成された IAM Role
   */
  readonly iamRole: iam.Role;
  /**
   * 設定された custom managed policy
   */
  readonly managedPolicies: iam.IManagedPolicy[];

  constructor(scope: Construct, id: string, props?: IamRoleProps) {
    super(scope, id);
    this.managedPolicies = [];

    //プロパティのデフォルト値設定
    props = props ?? {};
    props.servicePrincipal = props.servicePrincipal ?? 'ec2.amazonaws.com';

    let parameters: any = {
      assumedBy: new iam.ServicePrincipal(props.servicePrincipal),
    };

    //ロール名の指定
    if (props.roleName != null) {
      parameters = {
        ...parameters,
        roleName: props.roleName,
      };
    }

    //IAM Role
    const iamRole = new iam.Role(this, 'Default', parameters);

    //policy
    if (props.policyStatement != null) {
      const managedPolicy = new iam.ManagedPolicy(this, 'Policy', {
        document: iam.PolicyDocument.fromJson(props?.policyStatement),
      });
      iamRole.addManagedPolicy(managedPolicy);
      this.managedPolicies.push(managedPolicy);
    }

    this.iamRole = iamRole;
  }

  /**
   * AWS Managed Policy を追加する
   * @param managedPolicyName AWSのマネージドルール名
   * @example
   * ```
   * const iamRole = new IamRole(this, 'IamRole', {
   *   policyStatement: policyStatement,
   * });
   * iamRole.addAwsManagedPolicy('AWSLambdaExecute');
   * ```
   */
  addAwsManagedPolicy(managedPolicyName: string) {
    const awsManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName(managedPolicyName);
    this.iamRole.addManagedPolicy(awsManagedPolicy);
  }

  /**
   * Policy を追加する
   * @param policyStatement ポリシーステートメント
   * @param policyName 追加するポリシーに付ける名前（アカウント内でユニークな名前とすること）
   * @example
   * ```
   *  const policyStatement = {
   *    xxxxx
   *  }
   *  //IAMロール作成
   *  const iamRole = new IamRole(this, 'IamRole', {});
   *  iamRole.addManagedPolicy(policyStatement, 'bleafsi-shared-policy');
   * ```
   */
  addPolicy(policyStatement: any, policyName: string) {
    const managedPolicy = new iam.ManagedPolicy(this, 'ManagedPolicy', {
      managedPolicyName: `policyName-${this.node.addr}`,
      document: iam.PolicyDocument.fromJson(policyStatement),
    });

    this.iamRole.addManagedPolicy(managedPolicy);
    this.managedPolicies.push(managedPolicy);
  }

  /**
   * 既存のCustom Managed Policy を追加する
   * @param managedPolicyName 既存のマネージドポリシーの名前
   * @example
   * ```
   *  //IAMロール作成
   *  const iamRole = new IamRole(this, 'IamRole', {
   *   policyStatement: policyStatement,
   *  });
   *  iamRole.addManagedPolicy(managedPolicyName);
   * ```
   */
  addManagedPolicy(managedPolicyName: string) {
    const count = this.managedPolicies.length;
    const managedPolicy = iam.ManagedPolicy.fromManagedPolicyName(
      this,
      `${managedPolicyName}${count}`,
      managedPolicyName,
    );
    this.iamRole.addManagedPolicy(managedPolicy);
    this.managedPolicies.push(managedPolicy);
  }
}
