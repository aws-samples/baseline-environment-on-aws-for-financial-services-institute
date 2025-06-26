import { Construct } from 'constructs';
import { Resource, IResource, CustomResource, Stack, Duration } from 'aws-cdk-lib';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nag_suppressions from '../../nag-suppressions';
import { NagSuppressions } from 'cdk-nag';

export interface DomainProps {
  readonly name: string;
}

export interface IDomain extends IResource {
  readonly domainArn: string;
  readonly domainId: string;
}

export class Domain extends Resource implements IDomain {
  public readonly domainArn: string;
  public readonly domainId: string;

  constructor(scope: Construct, id: string, props: DomainProps) {
    super(scope, id);

    const provider = DomainProvider.getInstance(this);
    const resource = new CustomResource(this, 'Resource', {
      serviceToken: provider.serviceToken,
      properties: {
        Parameters: props,
      },
    });

    this.domainId = resource.getAttString('DomainId');

    const stack = Stack.of(this);
    this.domainArn = `arn:aws:cases:${stack.region}:${stack.account}:domain/${this.domainId}`;
  }
}

class DomainProvider extends Construct {
  public readonly serviceToken: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'domain.onEvent.ts'),
      handler: 'onEvent',
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15),
      description: 'Provider handler for ConnectCases domain operations',
      bundling: {
        externalModules: ['aws-sdk'],
      },
    });

    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cases:CreateDomain', 'cases:DeleteDomain', 'cases:GetDomain'],
        resources: ['*'],
      }),
    );

    nag_suppressions.addNagSuppressionsToLambda(onEventHandler);
    NagSuppressions.addResourceSuppressions(
      onEventHandler,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'onEventHandler needs to access dynamically created ConnectCases resources',
        },
      ],
      true,
    );

    const provider = new Provider(this, 'Provider', {
      onEventHandler,
    });

    this.serviceToken = provider.serviceToken;
    nag_suppressions.addNagSuppressionsToProvider(provider);
  }

  public static getInstance(scope: Construct): DomainProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'ConnectCasesDomainProvider';
    return (stack.node.tryFindChild(uniqueId) as DomainProvider) ?? new DomainProvider(stack, uniqueId);
  }
}
