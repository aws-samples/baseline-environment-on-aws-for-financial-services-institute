import { Construct } from 'constructs';
import { custom_resources, Stack, CustomResource, Duration, Fn } from 'aws-cdk-lib';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as nag_suppressions from '../../nag-suppressions';
import { NagSuppressions } from 'cdk-nag';

export type L1InstanceStorageConfigProps = connect.CfnInstanceStorageConfigProps;

export class L1InstanceStorageConfig extends Construct {
  public readonly attrAssociationId: string;

  constructor(scope: Construct, id: string, props: L1InstanceStorageConfigProps) {
    super(scope, id);

    if (
      [
        'CHAT_TRANSCRIPTS',
        'CALL_RECORDINGS',
        'SCHEDULED_REPORTS',
        'MEDIA_STREAMS',
        'CONTACT_TRACE_RECORDS',
        'AGENT_EVENTS',
      ].indexOf(props.resourceType) != -1
    ) {
      // Use the CloudFormation L1 construct for the supported resource types.
      const cfnResource = new connect.CfnInstanceStorageConfig(this, 'Resource', props);
      this.attrAssociationId = cfnResource.attrAssociationId;
    } else {
      // Use the custom resource to deploy a resource with the unsupported resource types.
      const provider = L1InstanceStorageConfigProvider.getInstance(this);
      const customResource = new CustomResource(this, 'Resource', {
        serviceToken: provider.serviceToken,
        properties: {
          Parameters: props,
        },
      });
      // For custom resources, we need to get the association ID from the response
      this.attrAssociationId = customResource.getAtt('AssociationId').toString();
    }
  }
}

class L1InstanceStorageConfigProvider extends Construct {
  public readonly serviceToken: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const onEventHandler = new NodejsFunction(this, 'OnEventHandler', {
      entry: path.join(__dirname, 'l1-instance-storage-config.onEvent.ts'),
      handler: 'onEvent',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(15),
      description:
        'Provider handler for Connect.associateInstanceStorageConfig() & disassociateInstanceStorageConfig()',
    });
    onEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'connect:AssociateInstanceStorageConfig',
          'connect:UpdateInstanceStorageConfig',
          'connect:DisassociateInstanceStorageConfig',
          'iam:PutRolePolicy',
          's3:GetBucketLocation',
          's3:GetBucketAcl',
          'kms:CreateGrant',
          'kms:DescribeKey',
          'kms:ListAliases',
          'kms:RetireGrant',
          'firehose:DescribeDeliveryStream',
          'firehose:PutRecord',
          'firehose:PutRecordBatch',
          'kinesis:DescribeStream',
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
          reason: 'onEventHandler needs to accesss dynamically created resources of IAM, S3, KMS, and Firehose',
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

  public static getInstance(scope: Construct): L1InstanceStorageConfigProvider {
    const stack = Stack.of(scope);
    const uniqueId = 'InstanceStorageConfigProvider';
    return (
      (stack.node.tryFindChild(uniqueId) as L1InstanceStorageConfigProvider) ??
      new L1InstanceStorageConfigProvider(stack, uniqueId)
    );
  }
}
