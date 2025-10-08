import { Resource, IResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as connect from 'aws-cdk-lib/aws-connect';
import { IInstance } from './instance';

export interface ContactFlowProps {
  readonly instance: IInstance;
  readonly name: string;
  readonly type: ContactFlowType;
  readonly content: string;
  readonly description?: string;
}

export enum ContactFlowType {
  CONTACT_FLOW = 'CONTACT_FLOW',
  CUSTOMER_QUEUE = 'CUSTOMER_QUEUE',
  CUSTOMER_HOLD = 'CUSTOMER_HOLD',
  CUSTOMER_WHISPER = 'CUSTOMER_WHISPER',
  AGENT_HOLD = 'AGENT_HOLD',
  AGENT_WHISPER = 'AGENT_WHISPER',
  OUTBOUND_WHISPER = 'OUTBOUND_WHISPER',
  AGENT_TRANSFER = 'AGENT_TRANSFER',
  QUEUE_TRANSFER = 'QUEUE_TRANSFER',
  CAMPAIGN = 'CAMPAIGN',
}

export interface IContactFlow extends IResource {
  readonly contactFlowArn: string;
  readonly contactFlowId: string;
}

export class ContactFlow extends Resource implements IContactFlow {
  public readonly contactFlowArn: string;
  public readonly contactFlowId: string;

  constructor(scope: Construct, id: string, props: ContactFlowProps) {
    super(scope, id);

    const contactFlow = new connect.CfnContactFlow(this, 'Resource', {
      instanceArn: props.instance.instanceArn,
      name: props.name,
      type: props.type,
      content: props.content,
      description: props.description,
    });

    this.contactFlowId = contactFlow.ref;
    this.contactFlowArn = contactFlow.attrContactFlowArn;

    this.node.addDependency(props.instance);
  }
}
