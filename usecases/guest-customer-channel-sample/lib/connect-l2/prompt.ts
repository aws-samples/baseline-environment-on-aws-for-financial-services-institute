import { Resource, IResource, CustomResource, Stack, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as custom_resources from 'aws-cdk-lib/custom-resources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { IInstance } from './instance';
import { NagSuppressions } from 'cdk-nag';
import * as nag_suppressions from '../nag-suppressions';

export interface PromptProps {
  readonly instance: IInstance;
  readonly name: string;
  readonly description?: string;
  readonly s3Uri?: string;
}

export interface PromptAttributes {
  readonly instance: IInstance;
  readonly name: string;
}

export interface IPrompt extends IResource {
  readonly promptArn: string;
  readonly promptId: string;
}

export class Prompt extends Resource implements IPrompt {
  public readonly promptArn: string;
  public readonly promptId: string;

  constructor(scope: Construct, id: string, props: PromptProps) {
    super(scope, id);

    const prompt = new connect.CfnPrompt(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      name: props.name,
      description: props.description,
      s3Uri: props.s3Uri,
    });

    this.promptId = prompt.ref;
    this.promptArn = prompt.attrPromptArn;

    this.node.addDependency(props.instance);
  }

  public static fromPromptName(scope: Construct, id: string, attrs: PromptAttributes): IPrompt {
    return new ImportedPrompt(scope, id, attrs);
  }
}

class ImportedPrompt extends CustomResource implements IPrompt {
  public readonly promptArn: string;
  public readonly promptId: string;

  constructor(scope: Construct, id: string, attrs: PromptAttributes) {
    const provider = ImportedPromptProvider.getInstance(scope);

    super(scope, id, {
      serviceToken: provider.serviceToken,
      properties: {
        Parameters: {
          InstanceId: attrs.instance.instanceId,
          PromptName: attrs.name,
        },
      },
    });

    provider.addPolicyForInstance(attrs.instance.instanceArn);

    this.promptArn = this.getAttString('PromptArn');
    this.promptId = this.getAttString('PromptId');
  }
}

class ImportedPromptProvider extends Construct {
  public readonly serviceToken: string;
  private readonly onEventHandler: lambda.IFunction;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'prompt.fromPromptName.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15),
      description: 'Provider handler for connect.listPrompts()',
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
        actions: ['connect:ListPrompts'],
        resources: [instanceArn],
      }),
    );
  }

  public static getInstance(scope: Construct): ImportedPromptProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'ImportedPromptProvider';
    return (stack.node.tryFindChild(uniqueId) as ImportedPromptProvider) ?? new ImportedPromptProvider(stack, uniqueId);
  }
}
