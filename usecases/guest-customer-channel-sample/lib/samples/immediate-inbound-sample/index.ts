import { Construct } from 'constructs';
import { CustomerChannelConnectInstance } from '../connect-instance';
import { ContactFlowType, TemplateContactFlow, Prompt, IQueue } from '../../constructs-l2/connect';
import * as qconnect_l2 from '../../constructs-l2/qconnect';
import * as path from 'path';

export interface ImmediateInboundSampleProps {
  readonly connectInstance: CustomerChannelConnectInstance;
  readonly queue: IQueue;
  readonly assistant?: qconnect_l2.IAssistant;
}

export class ImmediateInboundSample extends Construct {
  constructor(scope: Construct, id: string, props: ImmediateInboundSampleProps) {
    super(scope, id);

    const customerQueuePrompt = Prompt.fromPromptName(this, 'CustomerQueuePrompt', {
      name: 'CustomerQueue.wav',
      instance: props.connectInstance.instance,
    });
    const customerQueueFlow = new TemplateContactFlow(this, 'ImmediateCustomerQueueFlow', {
      instance: props.connectInstance.instance,
      name: 'ImmediateCustomerQueueFlow',
      type: ContactFlowType.CUSTOMER_QUEUE,
      description: 'Play prompt for waiting customers in Japanese.',
      path: path.join(__dirname, 'customer-queue-flow.json'),
      variables: {
        CustomerQueuePromptArn: customerQueuePrompt.promptArn,
      },
    });

    const beepPrompt = Prompt.fromPromptName(this, 'BeepPrompt', {
      name: 'Beep.wav',
      instance: props.connectInstance.instance,
    });
    const agentWhisperFlow = new TemplateContactFlow(this, 'ImmediateAgentWhisperFlow', {
      instance: props.connectInstance.instance,
      name: 'ImmediateAgentWhisperFlow',
      type: ContactFlowType.AGENT_WHISPER,
      description: 'Play beep prompt.',
      path: path.join(__dirname, 'agent-whisper-flow.json'),
      variables: {
        BeepPromptArn: beepPrompt.promptArn,
      },
    });

    new TemplateContactFlow(this, 'ImmediateInboundContactFlow', {
      instance: props.connectInstance.instance,
      name: 'ImmediateInboundContactFlow',
      type: ContactFlowType.CONTACT_FLOW,
      description: 'Accept contacts immediately.',
      path: path.join(__dirname, 'inbound-contact-flow.json'),
      variables: {
        QueueArn: props.queue.queueArn,
        CustomerQueueFlowArn: customerQueueFlow.contactFlowArn,
        AgentWhisperFlowArn: agentWhisperFlow.contactFlowArn,
        QconnectAssistantArn: props.assistant?.assistantArn ?? '',
      },
    });
  }
}
