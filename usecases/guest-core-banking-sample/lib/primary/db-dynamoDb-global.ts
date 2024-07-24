import { Construct } from 'constructs';
import { Fn, aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { RegionEnv } from 'bin/parameter';

/*
 * マルチリージョン マイクロサービス・アプリケーションが使用する
 * DynamoDB グローバルテーブルの作成
 */

export interface DbDynamoDbProps {
  primary: RegionEnv;
  secondary: RegionEnv;
}
export class DbDynamoDbGlobal extends Construct {
  public readonly tableName: string;
  public readonly table: dynamodb.CfnGlobalTable;
  constructor(scope: Construct, id: string, props: DbDynamoDbProps) {
    super(scope, id);

    // マルチリージョン マイクロサービス・アプリケーション用のスキーマを作成
    // see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_dynamodb.CfnGlobalTable.html
    this.table = new dynamodb.CfnGlobalTable(this, 'Default', {
      keySchema: [
        {
          attributeName: 'PK',
          keyType: 'HASH',
        },
        {
          attributeName: 'SK',
          keyType: 'RANGE',
        },
      ],
      attributeDefinitions: [
        {
          attributeName: 'PK',
          attributeType: 'S',
        },
        {
          attributeName: 'SK',
          attributeType: 'S',
        },
        {
          attributeName: 'GSI1',
          attributeType: 'S',
        },
      ],
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          keySchema: [
            {
              attributeName: 'GSI1',
              keyType: 'HASH',
            },
          ],
          projection: {
            projectionType: 'ALL',
          },
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

    // the table names are same for every region
    this.tableName = Fn.split('/', this.table.attrArn, 2)[1];
  }
}
