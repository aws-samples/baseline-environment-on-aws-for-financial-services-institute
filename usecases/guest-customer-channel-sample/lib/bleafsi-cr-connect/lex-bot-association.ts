import { Construct } from 'constructs';
import { custom_resources, Stack, CustomResource, Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as nag_suppressions from '../bleafsi-nag-suppressions';
import { getInstanceArnFromInstanceId } from './instance';

export interface LexBotV2Config {
  readonly aliasArn: string;
}
export interface LexBotAssociationProps {
  readonly instanceId: string;
  readonly lexV2Bot: LexBotV2Config;
}

export class LexBotAssociation extends Construct {
  constructor(scope: Construct, id: string, props: LexBotAssociationProps) {
    super(scope, id);

    const provider = LexBotAssociationProvider.getInstance(this);
    new CustomResource(this, 'LexBotAssociation', {
      serviceToken: provider.serviceToken,
      properties: {
        Parameters: {
          InstanceId: props.instanceId,
          LexV2Bot: {
            AliasArn: props.lexV2Bot.aliasArn,
          },
        },
      },
    });
    const instanceArn = getInstanceArnFromInstanceId(Stack.of(this), props.instanceId);
    provider.addPolicyForInstance(instanceArn);
    provider.addPolicyForLexBot(props.lexV2Bot.aliasArn);
  }
}

class LexBotAssociationProvider extends Construct {
  public readonly serviceToken: string;
  private readonly onEventHandler: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'lex-bot-association.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(15),
      description: 'Provider handler for Connect.associateBot() & disassociateBot()',
    });
    this.onEventHandler = onEventHandler;
    nag_suppressions.addNagSuppressionsToLambda(onEventHandler);

    const provider = new custom_resources.Provider(this, 'Provider', {
      onEventHandler,
    });
    this.serviceToken = provider.serviceToken;
    nag_suppressions.addNagSuppressionsToProvider(provider);
  }

  public addPolicyForInstance(instanceArn: string) {
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['connect:AssociateBot', 'connect:DisassociateBot'],
        resources: [instanceArn],
      }),
    );
  }
  public addPolicyForLexBot(lexAliasArn: string) {
    this.onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'lex:CreateResourcePolicy',
          'lex:DeleteResourcePolicy',
          'lex:UpdateResourcePolicy',
          'lex:DescribeBotAlias',
        ],
        resources: [lexAliasArn],
      }),
    );
  }

  public static getInstance(scope: Construct): LexBotAssociationProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'LexBotAssociationProvider';
    return (
      (stack.node.tryFindChild(uniqueId) as LexBotAssociationProvider) ?? new LexBotAssociationProvider(stack, uniqueId)
    );
  }
}
