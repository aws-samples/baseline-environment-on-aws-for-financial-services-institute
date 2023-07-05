import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';
import { IamRole } from './constructs/bleafsi-iam-role';

/*
 * 管理作業用に以下の4つの役割に対して、それぞれIAMポリシー/ロールとIAMグループを作成
 *  SysAdmin システム管理者
 *  IamAdmin IAM権限のみを持つ管理者
 *  ReadOnlyAdmin 参照権限のみを持つ管理者
 *  InstanceOps EC2周りの権限のみを持つ管理者
 */
export class IamSample extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // 1 SysAdminRole and SysAdminGroup
    const iamSysAdminRole = new IamRole(this, 'SysAdminRole', {
      policyStatement: sysAdminPolicyJSON,
    });
    new iam.Group(this, 'SysAdminGroup').addManagedPolicy(iamSysAdminRole.managedPolicies[0]);

    // 2 IamAdminRole and IamAdminGroup
    const iamAdminRole = new IamRole(this, 'IamAdminRole', {
      policyStatement: iamAdminPolicyJSON,
    });
    new iam.Group(this, 'IamAdminGroup').addManagedPolicy(iamAdminRole.managedPolicies[0]);

    // 3 InstanceOpsRole and InstanceOpsGroup
    const instanceOpsRole = new IamRole(this, 'InstanceOpsRole', {
      policyStatement: instanceOpsPolicyJSON,
    });
    new iam.Group(this, 'InstanceOpsGroup').addManagedPolicy(instanceOpsRole.managedPolicies[0]);

    // 4 ReadOnlyAdminRole and ReadOnlyAdminGroup
    const readOnlyAdminRole = new IamRole(this, 'ReadOnlyAdminRole', {
      policyStatement: readOnlyAdminPolicyJSON,
    });
    new iam.Group(this, 'ReadOnlyAdminGroup').addManagedPolicy(readOnlyAdminRole.managedPolicies[0]);
  }
}

/////////// IAMポリシー定義 /////////////////
const sysAdminPolicyJSON = {
  Version: '2012-10-17',
  Statement: [
    {
      Condition: {
        Bool: {
          'aws:MultiFactorAuthPresent': 'true',
        },
      },
      Resource: '*',
      Effect: 'Allow',
      NotAction: 'iam:*',
    },
    {
      Action: 'aws-portal:*Billing',
      Resource: '*',
      Effect: 'Deny',
    },
    {
      Action: ['cloudtrail:DeleteTrail', 'cloudtrail:StopLogging', 'cloudtrail:UpdateTrail'],
      Resource: '*',
      Effect: 'Deny',
    },
    {
      Action: [
        'kms:Create*',
        'kms:Revoke*',
        'kms:Enable*',
        'kms:Get*',
        'kms:Disable*',
        'kms:Delete*',
        'kms:Put*',
        'kms:Update*',
      ],
      Resource: '*',
      Effect: 'Deny',
    },
  ],
};

const iamAdminPolicyJSON = {
  Version: '2012-10-17',
  Statement: [
    {
      Condition: {
        Bool: {
          'aws:MultiFactorAuthPresent': 'true',
        },
      },
      Action: 'iam:*',
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: 'aws-portal:*Billing',
      Resource: '*',
      Effect: 'Deny',
    },
  ],
};

const instanceOpsPolicyJSON = {
  Version: '2012-10-17',
  Statement: [
    {
      Action: 'ec2:*',
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: 'elasticloadbalancing:*',
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: 'cloudwatch:*',
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: 'autoscaling:*',
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: [
        'ec2:CreateVpc*',
        'ec2:DeleteVpc*',
        'ec2:ModifyVpc*',
        'ec2:CreateSubnet*',
        'ec2:DeleteSubnet*',
        'ec2:ModifySubnet*',
        'ec2:Create*Route*',
        'ec2:DeleteRoute*',
        'ec2:AssociateRoute*',
        'ec2:ReplaceRoute*',
        'ec2:CreateVpn*',
        'ec2:DeleteVpn*',
        'ec2:AttachVpn*',
        'ec2:DetachVpn*',
        'ec2:CreateNetworkAcl*',
        'ec2:DeleteNetworkAcl*',
        'ec2:ReplaceNetworkAcl*',
        'ec2:*Gateway*',
        'ec2:*PeeringConnection*',
      ],
      Resource: '*',
      Effect: 'Deny',
    },
    {
      Action: 'aws-portal:*Billing',
      Resource: '*',
      Effect: 'Deny',
    },
    {
      Action: [
        'kms:Create*',
        'kms:Revoke*',
        'kms:Enable*',
        'kms:Get*',
        'kms:Disable*',
        'kms:Delete*',
        'kms:Put*',
        'kms:Update*',
      ],
      Resource: '*',
      Effect: 'Deny',
    },
  ],
};

const readOnlyAdminPolicyJSON = {
  Version: '2012-10-17',
  Statement: [
    {
      Action: [
        'appstream:Get*',
        'autoscaling:Describe*',
        'cloudformation:DescribeStacks',
        'cloudformation:DescribeStackEvents',
        'cloudformation:DescribeStackResource',
        'cloudformation:DescribeStackResources',
        'cloudformation:GetTemplate',
        'cloudformation:List*',
        'cloudfront:Get*',
        'cloudfront:List*',
        'cloudtrail:DescribeTrails',
        'cloudtrail:GetTrailStatus',
        'cloudwatch:Describe*',
        'cloudwatch:Get*',
        'cloudwatch:List*',
        'directconnect:Describe*',
        'dynamodb:GetItem',
        'dynamodb:BatchGetItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:DescribeTable',
        'dynamodb:ListTables',
        'ec2:Describe*',
        'elasticache:Describe*',
        'elasticbeanstalk:Check*',
        'elasticbeanstalk:Describe*',
        'elasticbeanstalk:List*',
        'elasticbeanstalk:RequestEnvironmentInfo',
        'elasticbeanstalk:RetrieveEnvironmentInfo',
        'elasticloadbalancing:Describe*',
        'elastictranscoder:Read*',
        'elastictranscoder:List*',
        'iam:List*',
        'iam:Get*',
        'kinesis:Describe*',
        'kinesis:Get*',
        'kinesis:List*',
        'opsworks:Describe*',
        'opsworks:Get*',
        'route53:Get*',
        'route53:List*',
        'redshift:Describe*',
        'redshift:ViewQueriesInConsole',
        'rds:Describe*',
        'rds:ListTagsForResource',
        's3:Get*',
        's3:List*',
        'sdb:GetAttributes',
        'sdb:List*',
        'sdb:Select*',
        'ses:Get*',
        'ses:List*',
        'sns:Get*',
        'sns:List*',
        'sqs:GetQueueAttributes',
        'sqs:ListQueues',
        'sqs:ReceiveMessage',
        'storagegateway:List*',
        'storagegateway:Describe*',
        'trustedadvisor:Describe*',
      ],
      Resource: '*',
      Effect: 'Allow',
    },
    {
      Action: 'aws-portal:*Billing',
      Resource: '*',
      Effect: 'Deny',
    },
  ],
};
