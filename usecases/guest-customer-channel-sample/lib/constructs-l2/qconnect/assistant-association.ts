import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as wisdom from 'aws-cdk-lib/aws-wisdom';
import { IAssistant } from './assistant';
import { IKnowledgeBase } from './knowledge-base';

export enum AssistantAssociationType {
  KNOWLEDGE_BASE = 'KNOWLEDGE_BASE',
}

export interface AssistantAssociationProps {
  readonly assistant: IAssistant;
  readonly associationType: AssistantAssociationType;
  readonly knowledgeBase?: IKnowledgeBase;
}

export interface IAssistantAssociation extends IResource {
  readonly assistantAssociationArn: string;
  readonly assistantAssociationId: string;
}

export class AssistantAssociation extends Resource implements IAssistantAssociation {
  public readonly assistantAssociationArn: string;
  public readonly assistantAssociationId: string;

  constructor(scope: Construct, id: string, props: AssistantAssociationProps) {
    super(scope, id);

    let association: wisdom.CfnAssistantAssociation.AssociationDataProperty;

    if (props.associationType === AssistantAssociationType.KNOWLEDGE_BASE && props.knowledgeBase) {
      association = {
        knowledgeBaseId: props.knowledgeBase.knowledgeBaseId,
      };
    } else {
      throw new Error(`For associationType ${props.associationType}, a knowledgeBase must be provided`);
    }

    const assistantAssociation = new wisdom.CfnAssistantAssociation(this, 'Resource', {
      assistantId: props.assistant.assistantId,
      associationType: props.associationType,
      association,
    });

    this.assistantAssociationArn = assistantAssociation.attrAssistantAssociationArn;
    this.assistantAssociationId = assistantAssociation.ref;

    this.node.addDependency(props.assistant);
  }
}
