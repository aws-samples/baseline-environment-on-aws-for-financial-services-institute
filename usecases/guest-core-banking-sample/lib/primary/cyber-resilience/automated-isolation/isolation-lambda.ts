import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { IsolationLambdaProps } from './types';
import * as path from 'path';

export class IsolationLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: IsolationLambdaProps) {
    super(scope, id);

    // Lambda実行ロール
    const lambdaRole = new iam.Role(this, 'IsolationLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    // EC2とSNSの権限を追加
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ec2:DescribeSubnets',
          'ec2:DescribeNetworkAcls',
          'ec2:CreateNetworkAcl',
          'ec2:CreateNetworkAclEntry',
          'ec2:ReplaceNetworkAclAssociation',
          'ec2:CreateTags',
        ],
        resources: ['*'],
      }),
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [props.snsTopicArn],
      }),
    );

    // Lambda関数
    this.function = new lambda.Function(this, 'IsolationFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'isolation-handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      role: lambdaRole,
      timeout: cdk.Duration.minutes(10), // 冪等性チェックと複数Subnet処理のため延長
      memorySize: 512, // メモリも増量
      environment: {
        VPC_ID: props.vpc.vpcId,
        SNS_TOPIC_ARN: props.snsTopicArn,
        ENV_NAME: props.envName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Lambda関数名にタグを追加
    cdk.Tags.of(this.function).add('Purpose', 'CyberResilienceIsolation');
    cdk.Tags.of(this.function).add('Environment', props.envName);
  }
}
