import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as wisdom from 'aws-cdk-lib/aws-wisdom';
import { IAssistant } from './assistant';
import { IAIPromptVersion } from './ai-prompt-version';

export enum AIAgentType {
  MANUAL_SEARCH = 'MANUAL_SEARCH',
  ANSWER_RECOMMENDATION = 'ANSWER_RECOMMENDATION',
  SELF_SERVICE = 'SELF_SERVICE',
}

export interface AnswerRecommendationAIAgentConfiguration {
  readonly answerGenerationPrompt: IAIPromptVersion;
  readonly queryReformulationPrompt: IAIPromptVersion;
  readonly intentLabelingGenerationPrompt: IAIPromptVersion;
  readonly locale: string;
}

export interface ManualSearchAIAgentConfiguration {
  readonly answerGenerationPrompt: IAIPromptVersion;
  readonly locale: string;
}

export interface SelfServiceAIAgentConfiguration {
  readonly selfServiceAnswerGenerationPrompt: IAIPromptVersion;
  readonly selfServicePreProcessingPrompt: IAIPromptVersion;
}

export interface AIAgentProps {
  readonly name: string;
  readonly description?: string;
  readonly assistant: IAssistant;
  readonly type: AIAgentType;
  readonly answerRecommendationConfiguration?: AnswerRecommendationAIAgentConfiguration;
  readonly manualSearchConfiguration?: ManualSearchAIAgentConfiguration;
  readonly selfServiceConfiguration?: SelfServiceAIAgentConfiguration;
}

export interface IAIAgent extends IResource {
  readonly aiAgentArn: string;
  readonly aiAgentId: string;
}

export class AIAgent extends Resource implements IAIAgent {
  public readonly aiAgentArn: string;
  public readonly aiAgentId: string;

  constructor(scope: Construct, id: string, props: AIAgentProps) {
    super(scope, id);

    let configuration: wisdom.CfnAIAgent.AIAgentConfigurationProperty;

    switch (props.type) {
      case AIAgentType.ANSWER_RECOMMENDATION:
        if (!props.answerRecommendationConfiguration) {
          throw new Error('answerRecommendationConfiguration is required for ANSWER_RECOMMENDATION type');
        }
        configuration = {
          answerRecommendationAiAgentConfiguration: {
            answerGenerationAiPromptId:
              props.answerRecommendationConfiguration.answerGenerationPrompt.aiPromptVersionId,
            queryReformulationAiPromptId:
              props.answerRecommendationConfiguration.queryReformulationPrompt.aiPromptVersionId,
            intentLabelingGenerationAiPromptId:
              props.answerRecommendationConfiguration.intentLabelingGenerationPrompt.aiPromptVersionId,
            locale: props.answerRecommendationConfiguration.locale,
          },
        };
        break;
      case AIAgentType.MANUAL_SEARCH:
        if (!props.manualSearchConfiguration) {
          throw new Error('manualSearchConfiguration is required for MANUAL_SEARCH type');
        }
        configuration = {
          manualSearchAiAgentConfiguration: {
            answerGenerationAiPromptId: props.manualSearchConfiguration.answerGenerationPrompt.aiPromptVersionId,
            locale: props.manualSearchConfiguration.locale,
          },
        };
        break;
      case AIAgentType.SELF_SERVICE:
        if (!props.selfServiceConfiguration) {
          throw new Error('selfServiceConfiguration is required for SELF_SERVICE type');
        }
        configuration = {
          selfServiceAiAgentConfiguration: {
            selfServiceAnswerGenerationAiPromptId:
              props.selfServiceConfiguration.selfServiceAnswerGenerationPrompt.aiPromptVersionId,
            selfServicePreProcessingAiPromptId:
              props.selfServiceConfiguration.selfServicePreProcessingPrompt.aiPromptVersionId,
          },
        };
        break;
      default:
        throw new Error(`Unsupported AI agent type: ${props.type}`);
    }

    const aiAgent = new wisdom.CfnAIAgent(this, 'Resource', {
      name: props.name,
      description: props.description,
      assistantId: props.assistant.assistantId,
      type: props.type,
      configuration,
    });

    this.aiAgentArn = aiAgent.attrAiAgentArn;
    this.aiAgentId = aiAgent.attrAiAgentId;

    this.node.addDependency(props.assistant);
  }
}
