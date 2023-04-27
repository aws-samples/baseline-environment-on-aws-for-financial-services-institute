import { Construct } from 'constructs';
import { custom_resources, Stack, CustomResource, Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as nag_suppressions from '../bleafsi-nag-suppressions';
import { NagSuppressions } from 'cdk-nag';

export type IdentityManagementType = 'SAML' | 'CONNECT_MANAGED' | 'EXISTING_DIRECTORY';

export interface InstanceProps {
  readonly instanceAlias: string;
  readonly inboundCallsEnabled: boolean;
  readonly outboundCallsEnabled: boolean;
  readonly identityManagementType: IdentityManagementType;
  readonly clientToken?: string;
  readonly directoryId?: string;
}

export function getInstanceArnFromInstanceId(stack: Stack, instanceId: string): string {
  return `arn:aws:connect:${stack.region}:${stack.account}:instance/${instanceId}`;
}

export class Instance extends Construct {
  readonly instanceId: string;
  readonly instanceArn: string;
  readonly serviceRole: iam.IRole;

  constructor(scope: Construct, id: string, props: InstanceProps) {
    super(scope, id);

    const instance = this.createInstance(props);

    this.instanceId = instance.getAttString('InstanceId');
    this.instanceArn = getInstanceArnFromInstanceId(Stack.of(this), this.instanceId);

    const serviceRoleArn = instance.getAttString('ServiceRole');
    this.serviceRole = iam.Role.fromRoleArn(this, 'ServiceRole', serviceRoleArn);
  }

  private createInstance(props: InstanceProps): CustomResource {
    return new CustomResource(this, 'Instance', {
      serviceToken: InstanceProvider.getInstance(this).serviceToken,
      properties: {
        InstanceAlias: props.instanceAlias,
        InboundCallsEnabled: props.inboundCallsEnabled,
        OutboundCallsEnabled: props.outboundCallsEnabled,
        IdentityManagementType: props.identityManagementType,
        ClientToken: props.clientToken,
        DirectoryId: props.directoryId,
      },
    });
  }
}

class InstanceProvider extends Construct {
  public readonly serviceToken: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'instance.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_18_X,
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            'connect:CreateInstance',
            'connect:DescribeInstance',
            'connect:DeleteInstance',
            'connect:UpdateInstanceAttribute',
            'ds:CheckAlias',
            'ds:CreateAlias',
            'ds:CreateIdentityPoolDirectory',
            'ds:DescribeDirectories',
            'ds:CreateDirectory',
            'ds:DeleteDirectory',
            'ds:AuthorizeApplication',
            'ds:UnauthorizeApplication',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          actions: ['iam:CreateServiceLinkedRole'],
          resources: ['*'],
          conditions: {
            StringLike: {
              'iam:AWSServiceName': 'connect.amazonaws.com',
            },
          },
        }),
      ],
      timeout: Duration.seconds(15),
      description: 'Provider handler for Connect.createInstance() & deleteInstance()',
    });
    nag_suppressions.addNagSuppressionsToLambda(onEventHandler);
    NagSuppressions.addResourceSuppressions(
      onEventHandler.role!,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is required to create a new Amazon Connect instance' }],
      true,
    );

    const isCompleteHandler = new NodejsFunction(this, 'IsCompleteHandler', {
      entry: path.join(__dirname, 'instance.isComplete.ts'),
      handler: 'isComplete',
      runtime: lambda.Runtime.NODEJS_18_X,
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['connect:DescribeInstance', 'ds:DescribeDirectories'],
          resources: ['*'],
        }),
      ],
      timeout: Duration.seconds(15),
      description: 'Provider handler for Connect.describeInstance()',
    });
    nag_suppressions.addNagSuppressionsToLambda(isCompleteHandler);
    NagSuppressions.addResourceSuppressions(
      isCompleteHandler.role!,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is required to create a new Amazon Connect instance' }],
      true,
    );

    const provider = new custom_resources.Provider(this, 'Provider', {
      onEventHandler: onEventHandler,
      isCompleteHandler: isCompleteHandler,
    });
    this.serviceToken = provider.serviceToken;
    nag_suppressions.addNagSuppressionsToProvider(provider);
  }

  public static getInstance(scope: Construct): InstanceProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'InstanceProvider';
    return (stack.node.tryFindChild(uniqueId) as InstanceProvider) ?? new InstanceProvider(stack, uniqueId);
  }
}
