import { Construct } from 'constructs';
import { aws_iam as iam } from 'aws-cdk-lib';

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

    // 1 Create SysAdminRole and SysAdminGroup
    new IamSysAdminRole(this, 'SysAdminRole');

    // 2 Create IamAdminRole and IamAdminGroup
    new IamAdminRole(this, 'IamAdminRole');

    // 3 Create InstanceOpsRole and InstanceOpsGroup
    new IamInstanceOpsRole(this, 'InstanceOpsRole');

    // 4 Create ReadOnlyAdminRole and ReadOnlyAdminGroup
    new IamReadOnlyAdminRole(this, 'ReadOnlyAdminRole');
  }
}

/////////// private Construct /////////////////
/*
 *  SysAdmin システム管理者
 */
class IamSysAdminRole extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const SysAdminManagedPolicy = new iam.ManagedPolicy(this, 'Policy', {
      document: iam.PolicyDocument.fromJson(sysAdminPolicyJSON),
    });

    new iam.Role(this, 'Default', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    }).addManagedPolicy(SysAdminManagedPolicy);

    new iam.Group(this, 'Group').addManagedPolicy(SysAdminManagedPolicy);
  }
}
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

/*
 *  IamAdmin IAM権限のみを持つ管理者
 */
class IamAdminRole extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const iamAdminManagedPolicy = new iam.ManagedPolicy(this, 'Policy', {
      document: iam.PolicyDocument.fromJson(iamAdminPolicyJSON),
    });

    new iam.Role(this, 'Default', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    }).addManagedPolicy(iamAdminManagedPolicy);

    new iam.Group(this, 'Group').addManagedPolicy(iamAdminManagedPolicy);
  }
}
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

/*
 *  ReadOnlyAdmin 参照権限のみを持つ管理者
 */
class IamInstanceOpsRole extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const instanceOpsManagedPolicy = new iam.ManagedPolicy(this, 'Policy', {
      document: iam.PolicyDocument.fromJson(instanceOpsPolicyJSON),
    });

    new iam.Role(this, 'Default', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    }).addManagedPolicy(instanceOpsManagedPolicy);

    new iam.Group(this, 'Group').addManagedPolicy(instanceOpsManagedPolicy);
  }
}
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

/*
 *  InstanceOps EC2周りの権限のみを持つ管理者
 */
class IamReadOnlyAdminRole extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    const readOnlyAdminManagedPolicy = new iam.ManagedPolicy(this, 'Policy', {
      document: iam.PolicyDocument.fromJson(readOnlyAdminPolicyJSON),
    });

    new iam.Role(this, 'Default', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    }).addManagedPolicy(readOnlyAdminManagedPolicy);

    new iam.Group(this, 'Group').addManagedPolicy(readOnlyAdminManagedPolicy);
  }
}
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
