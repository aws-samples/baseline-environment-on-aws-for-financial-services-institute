import { Resource, IResource, IResolvable } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as wisdom from 'aws-cdk-lib/aws-wisdom';
import { IAssistant } from './assistant';

export enum AIPromptApiFormat {
  ANTHROPIC_CLAUDE_MESSAGES = 'ANTHROPIC_CLAUDE_MESSAGES',
  ANTHROPIC_CLAUDE_TEXT_COMPLETIONS = 'ANTHROPIC_CLAUDE_TEXT_COMPLETIONS',
  MESSAGES = 'MESSAGES',
  TEXT_COMPLETIONS = 'TEXT_COMPLETIONS',
}

export type AIPromptModelId =
  | 'anthropic.claude-3-haiku--v1:0'
  | 'apac.amazon.nova-lite-v1:0'
  | 'apac.amazon.nova-micro-v1:0'
  | 'apac.amazon.nova-pro-v1:0'
  | 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0'
  | 'apac.anthropic.claude-3-haiku-20240307-v1:0'
  | 'eu.amazon.nova-lite-v1:0'
  | 'eu.amazon.nova-micro-v1:0'
  | 'eu.amazon.nova-pro-v1:0'
  | 'eu.anthropic.claude-3-7-sonnet-20250219-v1:0'
  | 'eu.anthropic.claude-3-haiku-20240307-v1:0'
  | 'us.amazon.nova-lite-v1:0'
  | 'us.amazon.nova-micro-v1:0'
  | 'us.amazon.nova-pro-v1:0'
  | 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
  | 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
  | 'us.anthropic.claude-3-haiku-20240307-v1:0';

export enum AIPromptTemplateType {
  TEXT = 'TEXT',
}

export enum AIPromptType {
  ANSWER_GENERATION = 'ANSWER_GENERATION',
  INTENT_LABELING_GENERATION = 'INTENT_LABELING_GENERATION',
  QUERY_REFORMULATION = 'QUERY_REFORMULATION',
  SELF_SERVICE_PRE_PROCESSING = 'SELF_SERVICE_PRE_PROCESSING',
  SELF_SERVICE_ANSWER_GENERATION = 'SELF_SERVICE_ANSWER_GENERATION',
}

export interface AIPromptProps {
  readonly name?: string;
  readonly description?: string;
  readonly assistant?: IAssistant;
  readonly apiFormat: AIPromptApiFormat;
  readonly modelId: AIPromptModelId;
  readonly templateType: AIPromptTemplateType;
  readonly type: AIPromptType;
  readonly templateText: string;
}

export interface IAIPrompt extends IResource {
  readonly aiPromptArn: string;
  readonly aiPromptId: string;
}

export class AIPrompt extends Resource implements IAIPrompt {
  public readonly aiPromptArn: string;
  public readonly aiPromptId: string;

  constructor(scope: Construct, id: string, props: AIPromptProps) {
    super(scope, id);

    const aiPrompt = new wisdom.CfnAIPrompt(this, 'Resource', {
      name: props.name,
      description: props.description,
      assistantId: props.assistant?.assistantId,
      apiFormat: props.apiFormat,
      modelId: props.modelId,
      templateType: props.templateType,
      type: props.type,
      templateConfiguration: {
        textFullAiPromptEditTemplateConfiguration: {
          text: props.templateText,
        },
      },
    });

    this.aiPromptArn = aiPrompt.attrAiPromptArn;
    this.aiPromptId = aiPrompt.attrAiPromptId;

    if (props.assistant) {
      this.node.addDependency(props.assistant);
    }
  }
}
