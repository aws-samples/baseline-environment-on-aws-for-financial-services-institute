import { Construct } from 'constructs';
import { custom_resources, Stack, CustomResource, Duration } from 'aws-cdk-lib';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as nag_suppressions from '../nag-suppressions';
import { NagSuppressions } from 'cdk-nag';

export type L1IntegrationAssociationProps = connect.CfnIntegrationAssociationProps;

export class L1IntegrationAssociation extends Construct {
  public readonly integrationAssociationId: string;
  public readonly integrationAssociationArn: string;

  constructor(scope: Construct, id: string, props: L1IntegrationAssociationProps) {
    super(scope, id);

    if (['LEX_BOT', 'LAMBDA_FUNCTION', 'APPLICATION'].indexOf(props.integrationType) === -1) {
      // Use the custom resource to deploy integration associations not supported by CloudFormation
      const provider = L1IntegrationAssociationProvider.getInstance(this);
      const customResource = new CustomResource(this, 'Resource', {
        serviceToken: provider.serviceToken,
        properties: {
          Parameters: props,
        },
      });

      this.integrationAssociationId = customResource.getAtt('IntegrationAssociationId').toString();
      this.integrationAssociationArn = customResource.getAtt('IntegrationAssociationArn').toString();
    } else {
      // Use the CloudFormation L1 construct for the supported resource types
      const cfnResource = new connect.CfnIntegrationAssociation(this, 'Resource', props);
      this.integrationAssociationId = cfnResource.attrIntegrationAssociationId;
      this.integrationAssociationArn = cfnResource.integrationArn;
    }
  }
}

class L1IntegrationAssociationProvider extends Construct {
  public readonly serviceToken: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'l1-integration-association.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15),
      description: 'Provider handler for Connect.createIntegrationAssociation() & deleteIntegrationAssociation()',
    });
    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'connect:CreateIntegrationAssociation',
          'connect:DeleteIntegrationAssociation',
          'connect:ListIntegrationAssociations',
          'wisdom:GetAssistant',
          'wisdom:GetKnowledgeBase',
          'wisdom:TagResource',
          'kms:CreateGrant',
          'cases:GetDomain',
          'iam:PutRolePolicy',
        ],
        resources: ['*'],
      }),
    );
    nag_suppressions.addNagSuppressionsToLambda(onEventHandler);
    NagSuppressions.addResourceSuppressions(
      onEventHandler,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'onEventHandler needs to access dynamically created Connect resources',
        },
      ],
      true,
    );

    const provider = new custom_resources.Provider(this, 'Provider', {
      onEventHandler,
    });
    this.serviceToken = provider.serviceToken;
    nag_suppressions.addNagSuppressionsToProvider(provider);
  }

  public static getInstance(scope: Construct): L1IntegrationAssociationProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'IntegrationAssociationProvider';
    return (
      (stack.node.tryFindChild(uniqueId) as L1IntegrationAssociationProvider) ??
      new L1IntegrationAssociationProvider(stack, uniqueId)
    );
  }
}
