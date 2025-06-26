import { ConnectCasesClient, CreateDomainCommand, DeleteDomainCommand } from '@aws-sdk/client-connectcases';
import { OnEventRequest, OnEventResponse } from 'aws-cdk-lib/custom-resources/lib/provider-framework/types';

const casesClient = new ConnectCasesClient();

export async function onEvent(event: OnEventRequest): Promise<OnEventResponse | undefined> {
  console.log('event = %o', event);
  if (event.RequestType === 'Create') {
    return await createDomain(event);
  } else if (event.RequestType === 'Update') {
    // Connect Cases doesn't support updating domains, so we'll just return the current state
    return await getDomainInfo(event);
  } else if (event.RequestType === 'Delete') {
    return await deleteDomain(event);
  }
  console.log(`Unexpected RequestType: ${event.RequestType}`);
  return undefined;
}

async function createDomain(event: OnEventRequest): Promise<OnEventResponse> {
  const props = event.ResourceProperties.Parameters as { name: string };

  const response = await casesClient.send(
    new CreateDomainCommand({
      name: props.name,
    }),
  );

  console.log(`connectcases.createDomain() => %o`, response);

  return {
    PhysicalResourceId: response.domainId,
    Data: {
      DomainId: response.domainId,
    },
  };
}

async function getDomainInfo(event: OnEventRequest): Promise<OnEventResponse> {
  const domainId = event.PhysicalResourceId;
  if (!domainId) {
    throw Error('getDomainInfo() requires event.PhysicalResourceId');
  }

  // Since there's no direct GetDomain API, we'll just return the domain ID
  return {
    PhysicalResourceId: domainId,
    Data: {
      DomainId: domainId,
    },
  };
}

async function deleteDomain(event: OnEventRequest): Promise<OnEventResponse> {
  const domainId = event.PhysicalResourceId;
  if (!domainId) {
    throw Error('deleteDomain() requires event.PhysicalResourceId');
  }

  const response = await casesClient.send(
    new DeleteDomainCommand({
      domainId: domainId,
    }),
  );

  console.log(`connectcases.deleteDomain() => %o`, response);

  return {
    PhysicalResourceId: domainId,
    Data: {},
  };
}
