import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { IamRole } from '../lib/bleafsi-iam-role';

/*
 * このサブプロジェクトのlib配下に作成した IAM Role Construct をテストするためのStack
 */

export class IamRoleStack extends cdk.Stack {
  readonly iamRoles: IamRole[];
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.iamRoles = [];
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

    //role1
    const iamRole1 = new IamRole(this, 'IamRole1', {
      policyStatement: policyStatement,
      roleName: 'bleafsi-test-role',
    });
    this.iamRoles.push(iamRole1);

    //role2
    const iamRole2 = new IamRole(this, 'IamRole2', {
      policyStatement: policyStatement,
      servicePrincipal: 'cloudtrail.amazonaws.com',
    });
    this.iamRoles.push(iamRole2);

    //role3
    const iamRole3 = new IamRole(this, 'IamRole3', {
      policyStatement: policyStatement,
    });
    iamRole3.addAwsManagedPolicy('AWSLambdaExecute');
    this.iamRoles.push(iamRole3);

    //role4
    const managedPolicy = new iam.ManagedPolicy(this, 'ManagedPolicy', {
      document: iam.PolicyDocument.fromJson(policyStatement),
    });
    const iamRole4 = new IamRole(this, 'IamRole4', {
      policyStatement: policyStatement,
    });
    iamRole4.addManagedPolicy(managedPolicy.managedPolicyName);
    this.iamRoles.push(iamRole4);
  }
}
