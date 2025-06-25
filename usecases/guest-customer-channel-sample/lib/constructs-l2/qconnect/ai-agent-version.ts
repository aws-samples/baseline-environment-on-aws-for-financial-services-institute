import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as wisdom from 'aws-cdk-lib/aws-wisdom';
import { IAIAgent } from './ai-agent';
import { IAssistant } from './assistant';

export interface AIAgentVersionProps {
  readonly aiAgent: IAIAgent;
  readonly assistant: IAssistant;
  readonly modifiedTimeSeconds?: number;
}

export interface IAIAgentVersion extends IResource {
  readonly aiAgentVersionId: string;
  readonly versionNumber: number;
}

export class AIAgentVersion extends Resource implements IAIAgentVersion {
  public readonly aiAgentVersionId: string;
  public readonly versionNumber: number;

  constructor(scope: Construct, id: string, props: AIAgentVersionProps) {
    super(scope, id);

    const aiAgentVersion = new wisdom.CfnAIAgentVersion(this, 'Resource', {
      aiAgentId: props.aiAgent.aiAgentId,
      assistantId: props.assistant.assistantId,
      modifiedTimeSeconds: props.modifiedTimeSeconds,
    });

    this.aiAgentVersionId = aiAgentVersion.attrAiAgentVersionId;
    this.versionNumber = aiAgentVersion.attrVersionNumber.toString() as unknown as number;

    this.node.addDependency(props.aiAgent);
    this.node.addDependency(props.assistant);
  }
}
