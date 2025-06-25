import { Resource, IResource, CustomResource, Stack, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as custom_resources from 'aws-cdk-lib/custom-resources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { IInstance, getInstanceArnFromInstanceId } from './instance';
import { IHoursOfOperation } from './hours-of-operation';
import { NagSuppressions } from 'cdk-nag';
import * as nag_suppressions from '../nag-suppressions';

export interface QueueProps {
  readonly instance: IInstance;
  readonly name: string;
  readonly description?: string;
  readonly hoursOfOperation: IHoursOfOperation;
  readonly maxContacts?: number;
  readonly outboundCallerConfig?: connect.CfnQueue.OutboundCallerConfigProperty;
  readonly quickConnectArns?: string[];
  readonly status?: string;
}

export interface IQueue extends IResource {
  readonly queueArn: string;
  readonly queueId: string;
}

export class Queue extends Resource implements IQueue {
  public readonly queueArn: string;
  public readonly queueId: string;

  constructor(scope: Construct, id: string, props: QueueProps) {
    super(scope, id);

    const queue = new connect.CfnQueue(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      name: props.name,
      description: props.description,
      hoursOfOperationArn: props.hoursOfOperation.hoursOfOperationArn,
      maxContacts: props.maxContacts,
      outboundCallerConfig: props.outboundCallerConfig,
      quickConnectArns: props.quickConnectArns,
      status: props.status,
    });

    this.queueId = queue.ref;
    this.queueArn = queue.attrQueueArn;

    this.node.addDependency(props.instance);
    this.node.addDependency(props.hoursOfOperation);
  }

  public static fromQueueName(scope: Construct, id: string, instanceId: string, queueName: string): IQueue {
    return new ImportedQueue(scope, id, instanceId, queueName);
  }
}

class ImportedQueue extends CustomResource implements IQueue {
  public readonly queueArn: string;
  public readonly queueId: string;

  constructor(scope: Construct, id: string, instanceId: string, queueName: string) {
    const provider = ImportedQueueProvider.getInstance(scope);

    super(scope, id, {
      serviceToken: provider.serviceToken,
      properties: {
        Parameters: {
          InstanceId: instanceId,
          QueueName: queueName,
        },
      },
    });

    const stack = Stack.of(scope);
    const instanceArn = getInstanceArnFromInstanceId(stack, instanceId);
    provider.addPolicyForInstance(instanceArn);

    this.queueArn = this.getAttString('QueueArn');
    this.queueId = this.getAttString('QueueId');
  }
}

class ImportedQueueProvider extends Construct {
  public readonly serviceToken: string;
  private readonly onEventHandler: lambda.IFunction;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'queue.fromQueueName.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15),
      description: 'Provider handler for connect.listQueues()',
    });
    this.onEventHandler = onEventHandler;
    nag_suppressions.addNagSuppressionsToLambda(onEventHandler);

    const provider = new custom_resources.Provider(this, 'Provider', {
      onEventHandler,
    });
    this.serviceToken = provider.serviceToken;
    nag_suppressions.addNagSuppressionsToProvider(provider);
  }

  public addPolicyForInstance(instanceArn: string) {
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['connect:ListQueues'],
        resources: [instanceArn + '/queue/*'],
      }),
    );
    if (this.onEventHandler.role) {
      NagSuppressions.addResourceSuppressions(
        this.onEventHandler.role,
        [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is required to list queues' }],
        true,
      );
    }
  }

  public static getInstance(scope: Construct): ImportedQueueProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'ImportedQueueProvider';
    return (stack.node.tryFindChild(uniqueId) as ImportedQueueProvider) ?? new ImportedQueueProvider(stack, uniqueId);
  }
}
