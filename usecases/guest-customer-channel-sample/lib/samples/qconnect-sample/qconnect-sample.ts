import { Construct } from 'constructs';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as connect_l2 from '../../connect-l2';
import * as qconnect_l2 from '../../constructs-l2/qconnect';
import * as appintegrations_l2 from '../../appintegrations-l2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as fs from 'fs';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import { PrivateBucket } from '../../s3-private-bucket';

export interface QconnectSampleProps {
  readonly instance: connect_l2.IInstance;
  readonly key: kms.IKey;
}

interface QconnectPromptProps {
  readonly name: string;
  readonly apiFormat: qconnect_l2.AIPromptApiFormat;
  readonly modelId: qconnect_l2.AIPromptModelId;
  readonly type: qconnect_l2.AIPromptType;
  readonly templateName: string;
}

type QconnectAgentProps = qconnect_l2.AIAgentProps;

export class QconnectSample extends Construct {
  readonly assistant: qconnect_l2.IAssistant;

  constructor(scope: Construct, id: string, props: QconnectSampleProps) {
    super(scope, id);

    const sourceBucket = new PrivateBucket(this, 'QconnectSourceBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.key,
    });
    this.addBucketPolicyForAppIntegrations(sourceBucket);

    const { assistant } = this.addQconnect(props, sourceBucket);
    this.assistant = assistant;
    this.addQconnectPrompts(assistant);
    this.addQconnectMonitoring(assistant);
  }

  private addQconnect(props: QconnectSampleProps, bucket: s3.IBucket) {
    const assistant = new qconnect_l2.Assistant(this, 'Assistant', {
      name: 'MyAssistant',
      encryptionKey: props.key,
    });

    new connect_l2.WisdomAssistantAssociation(this, 'WisdomAssociation', {
      instance: props.instance,
      assistant,
    });

    const integrationName = 'MyDataIntegration';

    const dataIntegration = new appintegrations_l2.DataIntegration(this, 'DataIntegration', {
      name: integrationName, // Use the same name with the knowledge base
      key: props.key,
      sourceUri: bucket.s3UrlForObject(),
    });

    const knowledgeBase = new qconnect_l2.KnowledgeBase(this, 'KnowledgeBase', {
      name: integrationName, // Use the same name with the data integration
      knowledgeBaseType: qconnect_l2.KnowledgeBaseType.EXTERNAL,
      encryptionKey: props.key,
      dataIntegration,
    });

    new qconnect_l2.AssistantAssociation(this, 'AssistantAssociation', {
      assistant,
      associationType: qconnect_l2.AssistantAssociationType.KNOWLEDGE_BASE,
      knowledgeBase,
    });

    new connect_l2.WisdomKnowledgeBaseAssociation(this, 'WisdomKnowledgeBaseAssociation', {
      instance: props.instance,
      knowledgeBase,
    });

    return { assistant };
  }

  private addQconnectPrompts(assistant: qconnect_l2.IAssistant) {
    const queryReformulationPrompt = this.addPrompt(assistant, {
      name: 'QueryReformulationPromptJapanese',
      apiFormat: qconnect_l2.AIPromptApiFormat.MESSAGES,
      modelId: 'apac.amazon.nova-lite-v1:0',
      type: qconnect_l2.AIPromptType.QUERY_REFORMULATION,
      templateName: 'query-reformulation',
    });

    const recommendIntentLabelingPrompt = this.addPrompt(assistant, {
      name: 'RecommendIntentLabelingPromptJapanese',
      apiFormat: qconnect_l2.AIPromptApiFormat.MESSAGES,
      modelId: 'apac.amazon.nova-lite-v1:0',
      type: qconnect_l2.AIPromptType.INTENT_LABELING_GENERATION,
      templateName: 'recommend-intent-labeling',
    });

    const manualSearchPrompt = this.addPrompt(assistant, {
      name: 'ManualSearchPromptJapanese',
      apiFormat: qconnect_l2.AIPromptApiFormat.TEXT_COMPLETIONS,
      modelId: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
      type: qconnect_l2.AIPromptType.ANSWER_GENERATION,
      templateName: 'manual-search',
    });

    const recommendationAgent = this.addAgent({
      name: 'RecommendationAgentJapanese',
      assistant,
      type: qconnect_l2.AIAgentType.ANSWER_RECOMMENDATION,
      answerRecommendationConfiguration: {
        answerGenerationPrompt: manualSearchPrompt.promptVersion,
        queryReformulationPrompt: queryReformulationPrompt.promptVersion,
        intentLabelingGenerationPrompt: recommendIntentLabelingPrompt.promptVersion,
        locale: 'ja_JP',
      },
    });

    const manualSearchAgent = this.addAgent({
      name: 'ManualSearchAgentJapanese',
      assistant,
      type: qconnect_l2.AIAgentType.MANUAL_SEARCH,
      manualSearchConfiguration: {
        answerGenerationPrompt: manualSearchPrompt.promptVersion,
        locale: 'ja_JP',
      },
    });

    const answerGenerationPrompt = this.addPrompt(assistant, {
      name: 'AnswerGenerationPromptJapanese',
      apiFormat: qconnect_l2.AIPromptApiFormat.TEXT_COMPLETIONS,
      modelId: 'apac.amazon.nova-pro-v1:0',
      type: qconnect_l2.AIPromptType.SELF_SERVICE_ANSWER_GENERATION,
      templateName: 'answer-generation',
    });

    const preProcessingPrompt = this.addPrompt(assistant, {
      name: 'PreProcessingPromptJapanese',
      apiFormat: qconnect_l2.AIPromptApiFormat.MESSAGES,
      modelId: 'apac.anthropic.claude-3-haiku-20240307-v1:0',
      type: qconnect_l2.AIPromptType.SELF_SERVICE_PRE_PROCESSING,
      templateName: 'pre-processing',
    });

    const selfServiceAgent = this.addAgent({
      name: 'SelfServiceAgentJapanese',
      assistant,
      type: qconnect_l2.AIAgentType.SELF_SERVICE,
      selfServiceConfiguration: {
        selfServiceAnswerGenerationPrompt: answerGenerationPrompt.promptVersion,
        selfServicePreProcessingPrompt: preProcessingPrompt.promptVersion,
      },
    });

    new qconnect_l2.AssistantAIAgentConfiguration(this, 'RecommendationAgentConfiguration', {
      assistant,
      agent: recommendationAgent.agentVersion,
      agentType: qconnect_l2.AIAgentType.ANSWER_RECOMMENDATION,
    });
    new qconnect_l2.AssistantAIAgentConfiguration(this, 'ManualSearchAgentConfiguration', {
      assistant,
      agent: manualSearchAgent.agentVersion,
      agentType: qconnect_l2.AIAgentType.MANUAL_SEARCH,
    });
    new qconnect_l2.AssistantAIAgentConfiguration(this, 'SelfServiceAgentConfiguration', {
      assistant,
      agent: selfServiceAgent.agentVersion,
      agentType: qconnect_l2.AIAgentType.SELF_SERVICE,
    });
  }

  private addPrompt(assistant: qconnect_l2.IAssistant, props: QconnectPromptProps) {
    const prompt = new qconnect_l2.AIPrompt(this, props.name, {
      assistant,
      apiFormat: props.apiFormat,
      modelId: props.modelId,
      type: props.type,
      templateType: qconnect_l2.AIPromptTemplateType.TEXT,
      templateText: fs.readFileSync(path.join(__dirname, 'prompt', `${props.templateName}.yaml`), 'utf-8'),
    });
    const promptVersion = new qconnect_l2.AIPromptVersion(this, `${props.name}Version`, {
      prompt,
      assistant,
    });
    return { prompt, promptVersion };
  }

  private addAgent(props: QconnectAgentProps) {
    const agent = new qconnect_l2.AIAgent(this, props.name, props);
    const agentVersion = new qconnect_l2.AIAgentVersion(this, `${props.name}Version`, {
      aiAgent: agent,
      assistant: props.assistant,
    });
    return { agent, agentVersion };
  }

  private addBucketPolicyForAppIntegrations(bucket: s3.IBucket) {
    const stack = Stack.of(this);

    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowAppIntegrationsDataIntegrations',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('app-integrations.amazonaws.com')],
        actions: ['s3:ListBucket', 's3:GetObject', 's3:GetBucketLocation'],
        resources: [bucket.bucketArn, bucket.arnForObjects('*')],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': stack.account,
          },
          ArnEquals: {
            'aws:SourceArn': `arn:aws:app-integrations:${stack.region}:${stack.account}:data-integration/*`,
          },
        },
      }),
    );
  }

  private addQconnectMonitoring(assistant: qconnect_l2.IAssistant) {
    // Create a CloudWatch Logs group for Amazon Q in Connect logs
    const logGroup = new logs.LogGroup(this, 'QConnectLogGroup', {
      logGroupName: '/aws/qconnect/assistants',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 1. Create a delivery source for the assistant
    const deliverySource = new logs.CfnDeliverySource(this, 'DeliverySource', {
      logType: 'EVENT_LOGS',
      name: `${assistant.assistantId}-delivery-source`,
      resourceArn: assistant.assistantArn,
    });
    deliverySource.node.addDependency(assistant);

    // 2. Configure where logs are stored
    const deliveryDestination = new logs.CfnDeliveryDestination(this, 'DeliveryDestination', {
      destinationResourceArn: logGroup.logGroupArn,
      name: `${assistant.assistantId}-delivery-destination`,
      outputFormat: 'json',
    });
    deliveryDestination.node.addDependency(logGroup);
    deliveryDestination.node.addDependency(assistant);

    // 3. Link the delivery source to the delivery destination
    const delivery = new logs.CfnDelivery(this, 'Delivery', {
      deliveryDestinationArn: deliveryDestination.attrArn,
      deliverySourceName: deliverySource.name,
    });
    delivery.node.addDependency(deliverySource);
    delivery.node.addDependency(deliveryDestination);
  }
}
