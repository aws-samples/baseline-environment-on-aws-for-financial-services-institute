import { Resource, IResource } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as wisdom from 'aws-cdk-lib/aws-wisdom';
import * as kms from 'aws-cdk-lib/aws-kms';

export enum AssistantType {
  AGENT = 'AGENT',
}

export interface AssistantProps {
  readonly name: string;
  readonly description?: string;
  readonly type?: AssistantType;
  readonly encryptionKey?: kms.IKey;
}

export interface IAssistant extends IResource {
  readonly assistantArn: string;
  readonly assistantId: string;
}

export class Assistant extends Resource implements IAssistant {
  public readonly assistantArn: string;
  public readonly assistantId: string;

  constructor(scope: Construct, id: string, props: AssistantProps) {
    super(scope, id);

    const serverSideEncryptionConfiguration = props.encryptionKey
      ? { kmsKeyId: props.encryptionKey.keyArn }
      : undefined;

    const assistant = new wisdom.CfnAssistant(this, 'Resource', {
      name: props.name,
      description: props.description,
      type: props.type || AssistantType.AGENT,
      serverSideEncryptionConfiguration,
    });

    this.assistantArn = assistant.attrAssistantArn;
    this.assistantId = assistant.ref;
  }
}
