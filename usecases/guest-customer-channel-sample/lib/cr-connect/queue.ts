import { Construct } from 'constructs';
import { custom_resources, CustomResource, Stack, Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as nag_suppressions from '../nag-suppressions';
import * as path from 'path';
import { getInstanceArnFromInstanceId } from './instance';
import { NagSuppressions } from 'cdk-nag';

export interface IQueue {
  readonly queueArn: string;
}

export class Queue {
  public static fromQueueName(scope: Construct, id: string, instanceId: string, queueName: string): IQueue {
    return new ImportedQueue(scope, id, instanceId, queueName);
  }
}

class ImportedQueue extends CustomResource implements IQueue {
  public readonly queueArn: string;

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
  }
}

class ImportedQueueProvider extends Construct {
  public readonly serviceToken: string;
  private readonly onEventHandler: lambda.IFunction;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'imported-queue.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_20_X,
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
