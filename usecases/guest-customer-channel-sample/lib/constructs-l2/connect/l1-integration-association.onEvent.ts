import {
  ConnectClient,
  CreateIntegrationAssociationCommand,
  DeleteIntegrationAssociationCommand,
  IntegrationType,
} from '@aws-sdk/client-connect';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';
import * as connect from 'aws-cdk-lib/aws-connect';

const connectClient = new ConnectClient();

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType === 'Create') {
    return await createIntegrationAssociation(event);
  } else if (event.RequestType === 'Update') {
    // For updates, delete the old association and create a new one
    await deleteIntegrationAssociation(event);
    return await createIntegrationAssociation(event);
  } else if (event.RequestType === 'Delete') {
    return await deleteIntegrationAssociation(event);
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function createIntegrationAssociation(event: OnEventRequest): Promise<OnEventResponse> {
  const cfnParams = event.ResourceProperties.Parameters as connect.CfnIntegrationAssociationProps;

  // Extract instance ID from ARN
  const instanceId = cfnParams.instanceId.split('/').pop();
  if (!instanceId) {
    throw new Error('Failed to extract instance ID from ARN: ' + cfnParams.instanceId);
  }

  const command = new CreateIntegrationAssociationCommand({
    InstanceId: instanceId,
    IntegrationType: cfnParams.integrationType as IntegrationType,
    IntegrationArn: cfnParams.integrationArn,
  });

  const response = await connectClient.send(command);
  console.log(`connect.createIntegrationAssociation() => %o`, response);

  return {
    PhysicalResourceId: response.IntegrationAssociationId,
    Data: {
      IntegrationAssociationId: response.IntegrationAssociationId,
      IntegrationAssociationArn: response.IntegrationAssociationArn,
    },
  };
}

async function deleteIntegrationAssociation(event: OnEventRequest): Promise<OnEventResponse> {
  const associationId = event.PhysicalResourceId;
  if (!associationId) {
    throw Error('deleteIntegrationAssociation() requires event.PhysicalResourceId');
  }

  const cfnParams = event.ResourceProperties.Parameters as connect.CfnIntegrationAssociationProps;

  // Extract instance ID from ARN
  const instanceId = cfnParams.instanceId.split('/').pop();
  if (!instanceId) {
    throw new Error('Failed to extract instance ID from ARN: ' + cfnParams.instanceId);
  }

  try {
    const command = new DeleteIntegrationAssociationCommand({
      InstanceId: instanceId,
      IntegrationAssociationId: associationId,
    });

    const response = await connectClient.send(command);
    console.log(`connect.deleteIntegrationAssociation() => %o`, response);
  } catch (error) {
    console.error('Error during integration association deletion:', error);
    // Don't throw on deletion errors to allow stack deletion to proceed
  }

  return {
    Data: {
      IntegrationAssociationId: associationId,
    },
  };
}
