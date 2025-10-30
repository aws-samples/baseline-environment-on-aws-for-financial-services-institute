import { Construct } from 'constructs';
import { custom_resources, Stack, CustomResource, Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as nag_suppressions from '../../nag-suppressions';
import { NagSuppressions } from 'cdk-nag';
import { IAssistant } from './assistant';
import { AIAgentType } from './ai-agent';
import { IAIAgentVersion } from './ai-agent-version';
import { UpdateAssistantAIAgentCommandInput } from '@aws-sdk/client-qconnect';

export interface AssistantAIAgentConfigurationProps {
  readonly assistant: IAssistant;
  readonly agent: IAIAgentVersion;
  readonly agentType: AIAgentType;
}

export class AssistantAIAgentConfiguration extends Construct {
  constructor(scope: Construct, id: string, props: AssistantAIAgentConfigurationProps) {
    super(scope, id);

    const input: UpdateAssistantAIAgentCommandInput = {
      assistantId: props.assistant.assistantId,
      aiAgentType: props.agentType,
      configuration: {
        aiAgentId: props.agent.aiAgentVersionId,
      },
    };

    const provider = AssistantAIAgentConfigurationProvider.getInstance(this);
    const customResource = new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        Parameters: input,
      },
    });

    customResource.node.addDependency(props.assistant, props.agent);
  }
}

class AssistantAIAgentConfigurationProvider extends Construct {
  public readonly serviceToken: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'assistant-ai-agent-configuration.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15),
      description: 'Provider handler for wisdom.updateAssistantAIAgent()',
    });
    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['wisdom:UpdateAssistantAIAgent', 'wisdom:RemoveAssistantAIAgent'],
        resources: ['*'],
      }),
    );
    nag_suppressions.addNagSuppressionsToLambda(onEventHandler);
    NagSuppressions.addResourceSuppressions(
      onEventHandler,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'onEventHandler needs to access dynamically created QConnect resources',
        },
      ],
      true,
    );

    const provider = new custom_resources.Provider(this, 'Provider', {
      onEventHandler,
    });
    this.serviceToken = provider.serviceToken;
    nag_suppressions.addNagSuppressionsToProvider(provider);
  }

  public static getInstance(scope: Construct): AssistantAIAgentConfigurationProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'AssistantAIAgentConfigurationProvider';
    return (
      (stack.node.tryFindChild(uniqueId) as AssistantAIAgentConfigurationProvider) ??
      new AssistantAIAgentConfigurationProvider(stack, uniqueId)
    );
  }
}
