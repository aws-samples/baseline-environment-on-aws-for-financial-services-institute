import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as wisdom from 'aws-cdk-lib/aws-wisdom';
import { IAIPrompt } from './ai-prompt';
import { IAssistant } from './assistant';

export interface AIPromptVersionProps {
  readonly prompt: IAIPrompt;
  readonly assistant: IAssistant;
  readonly modifiedTimeSeconds?: number;
}

export interface IAIPromptVersion extends IResource {
  readonly aiPromptVersionId: string;
  readonly versionNumber: number;
}

export class AIPromptVersion extends Resource implements IAIPromptVersion {
  public readonly aiPromptVersionId: string;
  public readonly versionNumber: number;

  constructor(scope: Construct, id: string, props: AIPromptVersionProps) {
    super(scope, id);

    const aiPromptVersion = new wisdom.CfnAIPromptVersion(this, 'Resource', {
      aiPromptId: props.prompt.aiPromptId,
      assistantId: props.assistant.assistantId,
      modifiedTimeSeconds: props.modifiedTimeSeconds,
    });

    this.aiPromptVersionId = aiPromptVersion.attrAiPromptVersionId;
    this.versionNumber = aiPromptVersion.attrVersionNumber.toString() as unknown as number;

    this.node.addDependency(props.prompt);
    this.node.addDependency(props.assistant);
  }
}
