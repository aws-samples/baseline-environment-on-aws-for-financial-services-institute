import {
  QConnectClient,
  UpdateAssistantAIAgentCommand,
  RemoveAssistantAIAgentCommand,
  UpdateAssistantAIAgentCommandInput,
} from '@aws-sdk/client-qconnect';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

const qconnectClient = new QConnectClient();

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType === 'Create' || event.RequestType === 'Update') {
    return await updateAssistantAIAgent(event);
  } else if (event.RequestType === 'Delete') {
    return await removeAssistantAIAgent(event);
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function updateAssistantAIAgent(event: OnEventRequest): Promise<OnEventResponse> {
  const params = event.ResourceProperties.Parameters as UpdateAssistantAIAgentCommandInput;

  try {
    // Update the AI agent to associate it with the assistant
    const updateCommand = new UpdateAssistantAIAgentCommand(params);
    const response = await qconnectClient.send(updateCommand);
    console.log(`qconnect.updateAssistantAIAgent() => %o`, response);

    const physicalResourceId = getPhysicalResourceId(params);
    return {
      PhysicalResourceId: physicalResourceId,
      Data: {
        aiAgentId: params.configuration?.aiAgentId,
        assistantId: params.assistantId,
        aiAgentType: params.aiAgentType,
      },
    };
  } catch (error) {
    console.error('Error during assistant AI agent configuration:', error);
    throw error;
  }
}

async function removeAssistantAIAgent(event: OnEventRequest): Promise<OnEventResponse> {
  const physicalResourceId = event.PhysicalResourceId;
  if (!physicalResourceId) {
    throw new Error('Physical resource ID is required for deletion');
  }

  const params = event.ResourceProperties.Parameters as UpdateAssistantAIAgentCommandInput;

  try {
    // Remove the AI agent association from the assistant
    const removeCommand = new RemoveAssistantAIAgentCommand({
      assistantId: params.assistantId,
      aiAgentType: params.aiAgentType,
    });

    const response = await qconnectClient.send(removeCommand);
    console.log(`qconnect.removeAssistantAIAgent() => %o`, response);

    return {
      PhysicalResourceId: physicalResourceId,
    };
  } catch (error) {
    console.error('Error during assistant AI agent removal:', error);
    // Don't throw on deletion errors to allow stack deletion to proceed
    return {
      PhysicalResourceId: physicalResourceId,
    };
  }
}

function getPhysicalResourceId(params: UpdateAssistantAIAgentCommandInput) {
  return `${params.assistantId}-${params.configuration?.aiAgentId}`;
}
