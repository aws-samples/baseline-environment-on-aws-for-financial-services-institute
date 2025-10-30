import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lex from 'aws-cdk-lib/aws-lex';
import { IInstance } from './instance';
import { IApplication } from '../appintegrations/application';
import { IAssistant, IKnowledgeBase } from '../qconnect';
import { L1IntegrationAssociation } from './l1-integration-association';

export enum IntegrationType {
  LEX_BOT = 'LEX_BOT',
  LAMBDA_FUNCTION = 'LAMBDA_FUNCTION',
  APPLICATION = 'APPLICATION',
  WISDOM_ASSISTANT = 'WISDOM_ASSISTANT',
  WISDOM_KNOWLEDGE_BASE = 'WISDOM_KNOWLEDGE_BASE',
  CASES_DOMAIN = 'CASES_DOMAIN',
}

export interface IntegrationAssociationProps {
  readonly instance: IInstance;
  readonly integrationType: IntegrationType;
  readonly integrationArn: string;
}

export interface IIntegrationAssociation extends IResource {
  readonly integrationAssociationId: string;
  readonly integrationAssociationArn: string;
}

export class IntegrationAssociation extends Resource implements IIntegrationAssociation {
  public readonly integrationAssociationId: string;
  public readonly integrationAssociationArn: string;

  constructor(scope: Construct, id: string, props: IntegrationAssociationProps) {
    super(scope, id);

    // Use L1IntegrationAssociation which handles both CloudFormation-supported and unsupported types
    const l1IntegrationAssociation = new L1IntegrationAssociation(this, 'Resource', {
      instanceId: props.instance.instanceArn, // Note: provide the ARN to instanceId
      integrationType: props.integrationType,
      integrationArn: props.integrationArn,
    });
    l1IntegrationAssociation.node.addDependency(props.instance);

    this.integrationAssociationId = l1IntegrationAssociation.integrationAssociationId;
    this.integrationAssociationArn = l1IntegrationAssociation.integrationAssociationArn;
  }
}

export interface LexIntegrationAssociationProps {
  readonly instance: IInstance;
  // TODO: We do not have L2 constructs for Lex yet.
  readonly botAlias: lex.CfnBotAlias;
}

export class LexIntegrationAssociation extends IntegrationAssociation {
  constructor(scope: Construct, id: string, props: LexIntegrationAssociationProps) {
    super(scope, id, {
      instance: props.instance,
      integrationType: IntegrationType.LEX_BOT,
      integrationArn: props.botAlias.attrArn,
    });

    this.node.addDependency(props.botAlias);
  }
}

export interface ApplicationIntegrationAssociationProps {
  readonly instance: IInstance;
  readonly application: IApplication;
}

export class ApplicationIntegrationAssociation extends IntegrationAssociation {
  constructor(scope: Construct, id: string, props: ApplicationIntegrationAssociationProps) {
    super(scope, id, {
      instance: props.instance,
      integrationType: IntegrationType.APPLICATION,
      integrationArn: props.application.applicationArn,
    });

    this.node.addDependency(props.application);
  }
}

export interface WisdomAssistantAssociationProps {
  readonly instance: IInstance;
  readonly assistant: IAssistant;
}

export class WisdomAssistantAssociation extends IntegrationAssociation {
  constructor(scope: Construct, id: string, props: WisdomAssistantAssociationProps) {
    super(scope, id, {
      instance: props.instance,
      integrationType: IntegrationType.WISDOM_ASSISTANT,
      integrationArn: props.assistant.assistantArn,
    });

    this.node.addDependency(props.assistant);
  }
}

export interface WisdomKnowledgeBaseAssociationProps {
  readonly instance: IInstance;
  readonly knowledgeBase: IKnowledgeBase;
}

export class WisdomKnowledgeBaseAssociation extends IntegrationAssociation {
  constructor(scope: Construct, id: string, props: WisdomKnowledgeBaseAssociationProps) {
    super(scope, id, {
      instance: props.instance,
      integrationType: IntegrationType.WISDOM_KNOWLEDGE_BASE,
      integrationArn: props.knowledgeBase.knowledgeBaseArn,
    });

    this.node.addDependency(props.knowledgeBase);
  }
}
