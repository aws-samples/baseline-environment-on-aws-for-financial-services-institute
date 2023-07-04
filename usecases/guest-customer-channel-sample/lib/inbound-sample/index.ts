import { Construct } from 'constructs';
import { CustomerChannelConnectInstance } from '../connect-instance';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as cr_connect from '../cr-connect';
import { NagSuppressions } from 'cdk-nag';
import * as lex from 'aws-cdk-lib/aws-lex';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as fs from 'fs';
import * as path from 'path';

export interface CustomerChannelInboundSampleProps {
  readonly connectInstance: CustomerChannelConnectInstance;
  readonly queue: cr_connect.IQueue;
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

    const botAssociation = new cr_connect.LexBotAssociation(this, 'IdentificationBotAssociation', {
      instanceId: connectInstance.instance.instanceId,
      lexV2Bot: {
        aliasArn: botAlias.attrArn,
      },
    });
    botAssociation.node.addDependency(connectInstance, bot);

    return botAlias;
  }

  private createInboundContactFlow(
    connectInstance: CustomerChannelConnectInstance,
    botAlias: lex.CfnBotAlias,
    queue: cr_connect.IQueue,
    agentWhisperFlow: connect.CfnContactFlow,
  ) {
    const contentPath = path.join(__dirname, 'inbound-contact-flow.json');
    const contentTemplate = fs.readFileSync(contentPath, 'utf-8');
    const content = contentTemplate
      .replace(/%BOT_ALIAS_ARN%/g, botAlias.attrArn)
      .replace(/%QUEUE_ARN%/g, queue.queueArn)
      .replace(/%AGENT_WHISPER_FLOW_ARN%/g, agentWhisperFlow.attrContactFlowArn);

    const contactFlow = new connect.CfnContactFlow(this, 'IdentificationInboundContactFlow', {
      instanceArn: connectInstance.instance.instanceArn,
      name: 'IdentificationInboundContactFlow',
      type: 'CONTACT_FLOW',
      content,
    });
    contactFlow.addDependency(agentWhisperFlow);
    return contactFlow;
  }

  private createAgentWhisperFlow(connectInstance: CustomerChannelConnectInstance) {
    const contentPath = path.join(__dirname, 'agent-whisper-flow.json');
    const content = fs.readFileSync(contentPath, 'utf-8');

    return new connect.CfnContactFlow(this, 'IdentificationAgentWhisperFlow', {
      instanceArn: connectInstance.instance.instanceArn,
      name: 'IdentificationAgentWhisperFlow',
      type: 'AGENT_WHISPER',
      content,
    });
  }
}
