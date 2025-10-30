import { Construct } from 'constructs';
import { CustomerChannelConnectInstance } from '../connect-instance';
import { NagSuppressions } from 'cdk-nag';
import * as lex from 'aws-cdk-lib/aws-lex';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as fs from 'fs';
import * as path from 'path';
import * as connect_l2 from '../../constructs-l2/connect';

export interface CustomerChannelInboundSampleProps {
  readonly connectInstance: CustomerChannelConnectInstance;
  readonly queue: connect_l2.IQueue;
}

export class CustomerChannelInboundSample extends Construct {
  constructor(scope: Construct, id: string, props: CustomerChannelInboundSampleProps) {
    super(scope, id);

    const botAlias = this.createLexBot(props.connectInstance);
    const agentWhisperFlow = this.createAgentWhisperFlow(props.connectInstance);
    this.createInboundContactFlow(props.connectInstance, botAlias, props.queue, agentWhisperFlow);
  }

  private createLexBot(connectInstance: CustomerChannelConnectInstance) {
    const botRole = new iam.Role(this, 'IdentificationBotRole', {
      assumedBy: new iam.ServicePrincipal('lexv2.amazonaws.com'),
    });
    botRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['polly:SynthesizeSpeech'],
        resources: ['*'],
      }),
    );
    NagSuppressions.addResourceSuppressions(
      botRole,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is required to use polly' }],
      true,
    );

    const botLocalesPath = path.join(__dirname, 'lex-bot-definition.json');
    const botLocales = JSON.parse(fs.readFileSync(botLocalesPath, 'utf-8'));

    const bot = new lex.CfnBot(this, 'IdentificationBot', {
      dataPrivacy: { ChildDirected: false },
      idleSessionTtlInSeconds: 300,
      name: 'IdentificationBot',
      roleArn: botRole.roleArn,
      autoBuildBotLocales: true,
      botLocales,
    });
    bot.node.addDependency(botRole);

    const botVersion = new lex.CfnBotVersion(this, 'IdentificationBotVersion', {
      botId: bot.attrId,
      botVersionLocaleSpecification: [
        {
          localeId: 'ja_JP',
          botVersionLocaleDetails: {
            sourceBotVersion: 'DRAFT',
          },
        },
      ],
    });
    botVersion.node.addDependency(bot);

    const botAlias = new lex.CfnBotAlias(this, 'IdentificationBotAlias', {
      botAliasName: 'IdentificationBotAlias',
      botId: bot.attrId,
      botVersion: botVersion.attrBotVersion,
      botAliasLocaleSettings: [
        {
          botAliasLocaleSetting: {
            enabled: true,
          },
          localeId: 'ja_JP',
        },
      ],
    });
    botAlias.node.addDependency(botVersion);

    new connect_l2.LexIntegrationAssociation(this, 'IdentificationBotAssociation', {
      instance: connectInstance.instance,
      botAlias: botAlias,
    });

    return botAlias;
  }

  private createInboundContactFlow(
    connectInstance: CustomerChannelConnectInstance,
    botAlias: lex.CfnBotAlias,
    queue: connect_l2.IQueue,
    agentWhisperFlow: connect_l2.IContactFlow,
  ) {
    const templateContactFlow = new connect_l2.TemplateContactFlow(this, 'IdentificationInboundContactFlow', {
      instance: connectInstance.instance,
      name: 'IdentificationInboundContactFlow',
      type: connect_l2.ContactFlowType.CONTACT_FLOW,
      path: path.join(__dirname, 'inbound-contact-flow.json'),
      variables: {
        BOT_ALIAS_ARN: botAlias.attrArn,
        QUEUE_ARN: queue.queueArn,
        AGENT_WHISPER_FLOW_ARN: agentWhisperFlow.contactFlowArn,
      },
    });

    templateContactFlow.node.addDependency(agentWhisperFlow);
    return templateContactFlow;
  }

  private createAgentWhisperFlow(connectInstance: CustomerChannelConnectInstance) {
    return new connect_l2.TemplateContactFlow(this, 'IdentificationAgentWhisperFlow', {
      instance: connectInstance.instance,
      name: 'IdentificationAgentWhisperFlow',
      type: connect_l2.ContactFlowType.AGENT_WHISPER,
      path: path.join(__dirname, 'agent-whisper-flow.json'),
    });
  }
}
