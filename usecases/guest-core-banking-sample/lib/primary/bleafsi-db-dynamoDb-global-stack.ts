import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { RegionEnv } from '../shared/bleafsi-types';

export interface DbDynamoDbStackProps extends cdk.NestedStackProps {
  primary: RegionEnv;
  secondary: RegionEnv;
}
export class DbDynamoDbGlobalStack extends cdk.NestedStack {
  public readonly table: dynamodb.Table;
  constructor(scope: Construct, id: string, props: DbDynamoDbStackProps) {
    super(scope, id, props);

    // Create dynammoDB global table
    // see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb.CfnGlobalTable.html
    new dynamodb.CfnGlobalTable(this, 'DynamoDB', {
      attributeDefinitions: [
        {
          attributeName: 'id',
          attributeType: dynamodb.AttributeType.STRING,
        },
      ],
      keySchema: [
        {
          attributeName: 'id',
          keyType: 'HASH',
        },
      ],
      replicas: [
        {
          region: props.primary.region,
          pointInTimeRecoverySpecification: {
            pointInTimeRecoveryEnabled: true,
          },
        },
        {
          region: props.secondary.region,
          pointInTimeRecoverySpecification: {
            pointInTimeRecoveryEnabled: true,
          },
        },
      ],
      streamSpecification: {
        streamViewType: 'NEW_AND_OLD_IMAGES',
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      sseSpecification: {
        sseEnabled: true,
        sseType: 'KMS',
      },
    });
  }
}
