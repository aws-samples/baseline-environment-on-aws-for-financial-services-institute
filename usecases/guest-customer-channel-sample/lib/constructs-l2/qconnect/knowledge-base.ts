import { Resource, IResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as wisdom from 'aws-cdk-lib/aws-wisdom';
import * as kms from 'aws-cdk-lib/aws-kms';

import { IDataIntegration } from '../appintegrations/data-integration';

export enum KnowledgeBaseType {
  EXTERNAL = 'EXTERNAL',
  CUSTOM = 'CUSTOM',
  MESSAGE_TEMPLATES = 'MESSAGE_TEMPLATES',
  MANAGED = 'MANAGED',
  QUICK_RESPONSES = 'QUICK_RESPONSES',
}

export interface KnowledgeBaseProps {
  readonly name: string;
  readonly description?: string;
  readonly knowledgeBaseType: KnowledgeBaseType;
  readonly renderingConfiguration?: wisdom.CfnKnowledgeBase.RenderingConfigurationProperty;
  readonly encryptionKey?: kms.IKey;

  readonly dataIntegration?: IDataIntegration;
  readonly objectFields?: string[];
}

export interface IKnowledgeBase extends IResource {
  readonly knowledgeBaseArn: string;
  readonly knowledgeBaseId: string;
}

export class KnowledgeBase extends Resource implements IKnowledgeBase {
  public readonly knowledgeBaseArn: string;
  public readonly knowledgeBaseId: string;

  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);

    const serverSideEncryptionConfiguration = props.encryptionKey
      ? { kmsKeyId: props.encryptionKey.keyArn }
      : undefined;

    let sourceConfiguration;
    if (props.dataIntegration) {
      sourceConfiguration = {
        appIntegrations: {
          appIntegrationArn: props.dataIntegration.dataIntegrationArn,
          objectFields: props.objectFields,
        },
      };
    }

    const knowledgeBase = new wisdom.CfnKnowledgeBase(this, 'Resource', {
      name: props.name,
      description: props.description,
      knowledgeBaseType: props.knowledgeBaseType,
      renderingConfiguration: props.renderingConfiguration,
      sourceConfiguration,
      serverSideEncryptionConfiguration,
    });

    this.knowledgeBaseArn = knowledgeBase.attrKnowledgeBaseArn;
    this.knowledgeBaseId = knowledgeBase.ref;
  }
}
