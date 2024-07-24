import { Handler } from 'aws-lambda';

type Input = {
  /**
   * AWS Region name to call the service
   */
  targetRegion: string;

  /**
   * Custom endpoint for an AWS API (for example, when using a local version of S3)
   */
  endpoint?: string;

  /**
   * AWS service name (must be in AWS SDK for JS v3 style)
   */
  service: string;

  /**
   * API Action name (must be in PascalCase)
   */
  action: string;

  /**
   * request parameters to call the API (must be in AWS SDK for JS v3 style)
   */
  parameters: any;
};

// reference: code from CDK AwsCustomResource
function findV3ClientConstructor(pkg: object) {
  const [_clientName, ServiceClient] = Object.entries(pkg).find(([name]) => {
    // Services expose a base __Client class that we don't want ever
    return name.endsWith('Client') && name !== '__Client';
  }) as [
    string,
    {
      new (config: any): {
        send: (command: any) => Promise<any>;
        config: any;
      };
    },
  ];
  return ServiceClient;
}

function findCommandClass(pkg: object, action: string) {
  const commandName = `${action}Command`;
  const Command = Object.entries(pkg).find(([name]) => name.toLowerCase() === commandName.toLowerCase())?.[1] as {
    new (input: any): any;
  };
  if (!Command) {
    throw new Error(`Unable to find command named: ${commandName} for action: ${action} in service package ${pkg}`);
  }
  return Command;
}

export const handler: Handler<Input> = async (event, context) => {
  // Log the event to understand the incoming request structure
  console.log('Event: ', event);

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require(`@aws-sdk/client-${event.service}`);
    const Client = findV3ClientConstructor(pkg);
    const Command = findCommandClass(pkg, event.action);

    const client = new Client({ region: event.targetRegion, endpoint: event.endpoint });
    const command = new Command(event.parameters);
    const res = await client.send(command);

    return res;
  } catch (error) {
    console.error('Error: ', error);
    throw error;
  }
};
