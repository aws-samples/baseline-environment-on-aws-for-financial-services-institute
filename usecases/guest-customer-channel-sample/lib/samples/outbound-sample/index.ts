import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctions_tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Fn, CfnOutput, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CustomerChannelConnectInstance } from '../connect-instance';
import * as nag_suppressions from '../../nag-suppressions';
import { NagSuppressions } from 'cdk-nag';
import * as fs from 'fs';
import * as path from 'path';

export interface CustomerChannelOutboundSampleProps {
  readonly connectInstance: CustomerChannelConnectInstance;
}

export class CustomerChannelOutboundSample extends Construct {
  constructor(scope: Construct, id: string, props: CustomerChannelOutboundSampleProps) {
    super(scope, id);

    const contactTable = this.createContactTable();
    const startOutboundStateMachine = this.createStartOutboundStateMachine(props.connectInstance, contactTable);
    const api = this.createStartContactApi(startOutboundStateMachine);
    this.createEndContactWorkflow(props.connectInstance, contactTable);

    const region = Stack.of(scope).region;
    const curlCommand = `source <(aws configure export-credentials --format env-no-export) && \
curl -vvv -X POST -H "Content-Type: application/json" -H "X-Amz-Security-Token: \${AWS_SESSION_TOKEN}" \
--user "\${AWS_ACCESS_KEY_ID}:\${AWS_SECRET_ACCESS_KEY}" --aws-sigv4 "aws:amz:${region}:execute-api" \
-d '{"DestinationPhoneNumber": "+81xxxxxxxxx", "SourcePhoneNumber":"+81xxxxxxxxxx", "Message": "Enter your message here"}' \
${api.url}`;
    new CfnOutput(this, 'StartOutboundCurlCommand', { value: curlCommand });
  }

  private createContactTable() {
    return new dynamodb.Table(this, 'ContactTable', {
      partitionKey: { name: 'ContactId', type: dynamodb.AttributeType.STRING },
    });
  }

  private createStartOutboundStateMachine(
    connectInstance: CustomerChannelConnectInstance,
    contactTable: dynamodb.Table,
  ): stepfunctions.IStateMachine {
    const contactFlow = this.createOutboundContactFlow(connectInstance);

    const definition = new stepfunctions_tasks.CallAwsService(this, 'StartOutboundVoiceContact', {
      service: 'connect',
      action: 'startOutboundVoiceContact',
      parameters: {
        ContactFlowId: Fn.select(3, Fn.split('/', contactFlow.attrContactFlowArn)),
        InstanceId: connectInstance.instance.instanceId,
        'DestinationPhoneNumber.$': '$.body.DestinationPhoneNumber',
        'SourcePhoneNumber.$': '$.body.SourcePhoneNumber',
        Attributes: {
          'Message.$': '$.body.Message',
        },
      },
      iamResources: [connectInstance.instance.instanceArn + '/contact/*'],
      resultPath: '$.StartOutboundVoiceContactResult',
    }).next(
      new stepfunctions_tasks.CallAwsService(this, 'PutItem', {
        service: 'dynamodb',
        action: 'putItem',
        parameters: {
          TableName: contactTable.tableName,
          Item: {
            ContactId: {
              'S.$': '$.StartOutboundVoiceContactResult.ContactId',
            },
            State: {
              S: 'INITIATED',
            },
            Message: {
              'S.$': '$.body.Message',
            },
            StartTime: {
              'S.$': '$$.State.EnteredTime',
            },
          },
        },
        iamResources: [contactTable.tableArn],
      }),
    );

    const logGroup = new logs.LogGroup(this, 'StartOutboundStateMachineLogGroup');

    const stateMachine = new stepfunctions.StateMachine(this, 'StartOutboundStateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(definition),
      stateMachineType: stepfunctions.StateMachineType.EXPRESS,
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: stepfunctions.LogLevel.ALL,
      },
    });
    NagSuppressions.addResourceSuppressions(
      stateMachine.role,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is required to invoke connect:StartOutboundVoiceContact' }],
      true,
    );

    return stateMachine;
  }

  private createStartContactApi(stateMachine: stepfunctions.IStateMachine) {
    const logGroup = new logs.LogGroup(this, 'StartOutboundApiLogGroup');
    const api = new apigateway.RestApi(this, 'StartOutboundApi', {
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
    });
    nag_suppressions.addNagSuppressionsToRestApi(api);

    const model = api.addModel('StartOutboundApiModel', {
      contentType: 'application/json',
      schema: {
        schema: apigateway.JsonSchemaVersion.DRAFT4,
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          DestinationPhoneNumber: { type: apigateway.JsonSchemaType.STRING },
          SourcePhoneNumber: { type: apigateway.JsonSchemaType.STRING },
          Message: { type: apigateway.JsonSchemaType.STRING },
        },
        required: ['DestinationPhoneNumber', 'SourcePhoneNumber', 'Message'],
      },
    });
    const requestValidator = api.addRequestValidator('StartOutboundRequestValidator', {
      validateRequestBody: true,
    });

    const method = api.root.addMethod('ANY', apigateway.StepFunctionsIntegration.startExecution(stateMachine), {
      authorizationType: apigateway.AuthorizationType.IAM,
      requestValidator,
      requestModels: {
        'application/json': model,
      },
    });
    nag_suppressions.addNagSuppressionsToApiMethod(method);

    return api;
  }

  private createEndContactWorkflow(connectInstance: CustomerChannelConnectInstance, contactTable: dynamodb.Table) {
    const getContactAttributes = new stepfunctions_tasks.CallAwsService(this, 'GetContactAttributes', {
      service: 'connect',
      action: 'getContactAttributes',
      parameters: {
        'InitialContactId.$': '$.detail.contactId',
        InstanceId: connectInstance.instance.instanceId,
      },
      resultPath: '$.AttributesResult',
      iamResources: [connectInstance.instance.instanceArn + '/contact/*'],
    }).next(
      new stepfunctions_tasks.CallAwsService(this, 'UpdateItem', {
        service: 'dynamodb',
        action: 'updateItem',
        parameters: {
          TableName: contactTable.tableName,
          Key: {
            ContactId: {
              'S.$': '$.detail.contactId',
            },
          },
          UpdateExpression: 'SET EndTime=:EndTime, #St=:St, Responded=:Responded',
          ExpressionAttributeNames: {
            '#St': 'State',
          },
          ExpressionAttributeValues: {
            ':EndTime': {
              'S.$': '$$.State.EnteredTime',
            },
            // Note: Avoid the reserved word "state"
            ':St': {
              S: 'DISCONNECTED',
            },
            ':Responded': {
              'Bool.$': '$.AttributesResult.Attributes.Responded',
            },
          },
        },
        iamResources: [contactTable.tableArn],
      }),
    );

    const logGroup = new logs.LogGroup(this, 'EndOutboundLogGroup');

    const endContactStateMachine = new stepfunctions.StateMachine(this, 'EndOutboundContactStateMachine', {
      definitionBody: stepfunctions.DefinitionBody.fromChainable(getContactAttributes),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: stepfunctions.LogLevel.ALL,
      },
    });
    NagSuppressions.addResourceSuppressions(
      endContactStateMachine.role,
      [{ id: 'AwsSolutions-IAM5', reason: 'Wildcard is required to invoke connect:GetContactAttributes' }],
      true,
    );

    const endContactRule = new events.Rule(this, 'EndOutboundContactRule', {
      eventPattern: {
        source: ['aws.connect'],
        detailType: ['Amazon Connect Contact Event'],
        detail: {
          eventType: ['DISCONNECTED'],
          channel: ['VOICE'],
          instanceArn: [connectInstance.instance.instanceArn],
        },
      },
    });
    endContactRule.addTarget(new events_targets.SfnStateMachine(endContactStateMachine));
  }

  private createOutboundContactFlow(connectInstance: CustomerChannelConnectInstance) {
    const contentPath = path.join(__dirname, 'outbound-contact-flow.json');
    const content = fs.readFileSync(contentPath, 'utf-8');

    return new connect.CfnContactFlow(this, 'OutboundContactFlow', {
      instanceArn: connectInstance.instance.instanceArn,
      name: 'SampleOutboundContactFlow',
      type: 'CONTACT_FLOW',
      content,
    });
  }
}
