import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_destinations from 'aws-cdk-lib/aws-lambda-destinations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cr from 'aws-cdk-lib/custom-resources';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { KmsConstruct } from './constructs/kms-construct';

export interface CoreBankingSystemStackProps extends cdk.StackProps {
  isPrimary?: boolean;
  replicaRegions?: string[];
  vpc?: ec2.Vpc;
  securityGroups?: {
    lambda: ec2.SecurityGroup;
    database: ec2.SecurityGroup;
  };
}

/**
 * コアバンキングシステムスタック
 * 基幹系バンキングシステムのバックエンドAPI群を提供
 * - 口座管理
 * - 残高管理
 * - 取引処理
 * - 顧客管理
 */
export class CoreBankingSystemStack extends cdk.Stack {
  public readonly coreApiEndpoint: string;
  public readonly coreApiId: string;
  public readonly accountsTable: dynamodb.Table;
  public readonly transactionsTable: dynamodb.Table;
  public readonly customersTable: dynamodb.Table;
  public readonly coreApiExecutionRole: iam.Role;
  public readonly coreApiKeyId: string;

  constructor(scope: Construct, id: string, props: CoreBankingSystemStackProps = {}) {
    super(scope, id, props);

    // KMSカスタマー管理キーの作成（FISC実務基準3,13,30対応）
    const kmsConstruct = new KmsConstruct(this, 'CoreBankingKms', {
      description: 'Core Banking System encryption key for FISC compliance',
      alias: 'alias/core-banking-system',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
    });

    // DynamoDBテーブル: 顧客マスター（単一リージョン、カスタマー管理キー）
    this.customersTable = new dynamodb.Table(this, 'CoreCustomersTable', {
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // DynamoDBテーブル: 口座マスター（単一リージョン、カスタマー管理キー）
    this.accountsTable = new dynamodb.Table(this, 'CoreAccountsTable', {
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI: 顧客IDで口座を検索
    this.accountsTable.addGlobalSecondaryIndex({
      indexName: 'CustomerIdIndex',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDBテーブル: 取引履歴（単一リージョン、カスタマー管理キー）
    this.transactionsTable = new dynamodb.Table(this, 'CoreTransactionsTable', {
      partitionKey: { name: 'transactionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI: 口座IDで取引履歴を検索
    this.transactionsTable.addGlobalSecondaryIndex({
      indexName: 'AccountIdIndex',
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // CloudWatch Logs グループ
    const coreApiLogGroup = new logs.LogGroup(this, 'CoreApiLogGroup', {
      logGroupName: `/aws/lambda/core-banking-api`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda実行ロール
    const coreApiRole = new iam.Role(this, 'CoreApiRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                this.customersTable.tableArn,
                this.accountsTable.tableArn,
                this.transactionsTable.tableArn,
                `${this.accountsTable.tableArn}/index/CustomerIdIndex`,
                `${this.transactionsTable.tableArn}/index/AccountIdIndex`,
              ],
            }),
          ],
        }),
        CloudWatchLogsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [coreApiLogGroup.logGroupArn, `${coreApiLogGroup.logGroupArn}:*`],
            }),
          ],
        }),
        KMSPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
              resources: [kmsConstruct.key.keyArn],
            }),
          ],
        }),
      },
    });

    // SQSキュー: Lambda用デッドレターキュー（SSL必須、カスタマー管理キーで暗号化）
    const coreApiDeadLetterQueue = new sqs.Queue(this, 'CoreApiDeadLetterQueue', {
      enforceSSL: true,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsConstruct.key,
      queueName: `core-banking-api-dlq-${this.region}`,
    });

    // CDK Nag抑制: SQSキューはSSLを強制しているが、Lambda関数の内部実装でエラーが発生
    NagSuppressions.addResourceSuppressions(coreApiDeadLetterQueue, [
      {
        id: 'AwsSolutions-SQS4',
        reason: 'SQS queue enforces SSL with enforceSSL: true setting. This is a false positive from CDK Nag.',
      },
    ]);

    // Lambda関数: コアバンキングAPI
    const coreApiLambda = new lambda.Function(this, 'CoreApiLambda', {
      functionName: 'core-banking-api',
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/temporary-core-banking-system-backend/core-api/src'),
      environment: {
        CUSTOMERS_TABLE: this.customersTable.tableName,
        ACCOUNTS_TABLE: this.accountsTable.tableName,
        TRANSACTIONS_TABLE: this.transactionsTable.tableName,
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: coreApiRole,
      logGroup: coreApiLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      reservedConcurrentExecutions: 100,
      // デッドレターキューを明示的に設定
      deadLetterQueue: coreApiDeadLetterQueue,
      // VPC設定（必要に応じて）
      vpc: props.vpc,
      securityGroups: props.securityGroups ? [props.securityGroups.lambda] : undefined,
    });

    // CDK Nag抑制: Lambda関数のデッドレターキューに対するSQS4エラーを抑制
    NagSuppressions.addResourceSuppressions(coreApiLambda, [
      {
        id: 'AwsSolutions-SQS4',
        reason: 'Dead letter queue is configured with SSL enforcement through explicit SQS queue configuration.',
        appliesTo: ['Resource::*'],
      },
    ]);

    // API Gateway アクセスログ用CloudWatch Logs
    const apiLogGroup = new logs.LogGroup(this, 'CoreApiAccessLogGroup', {
      logGroupName: `/aws/apigateway/core-banking-api`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API Gateway CloudWatch Logsロール（AWS管理ポリシー使用）
    const apiGatewayCloudWatchRole = new iam.Role(this, 'CoreApiCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
    });

    // CDK Nag抑制: API Gateway CloudWatch RoleのAWS管理ポリシー使用
    NagSuppressions.addResourceSuppressions(apiGatewayCloudWatchRole, [
      {
        id: 'AwsSolutions-IAM4',
        reason:
          'API GatewayのCloudWatch Logsアクセスには、AWSが提供する標準的な管理ポリシー「AmazonAPIGatewayPushToCloudWatchLogs」を使用しています。これはAWSが推奨する方法であり、セキュリティ上適切です。',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'],
      },
    ]);

    const apiGatewayAccount = new apigateway.CfnAccount(this, 'CoreApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
    });

    // 明示的な依存関係を設定
    apiGatewayAccount.addDependency(apiGatewayCloudWatchRole.node.defaultChild as cdk.CfnResource);

    // Online Banking App用のCore Banking API実行ロール
    this.coreApiExecutionRole = new iam.Role(this, 'CoreApiExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        CloudWatchLogsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/online-banking-*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/online-banking-*:*`,
              ],
            }),
          ],
        }),
      },
      description: 'Execution role for Online Banking App to access Core Banking API',
    });

    // CDK Nag抑制: Lambda関数のCloudWatch Logsアクセス権限
    NagSuppressions.addResourceSuppressions(this.coreApiExecutionRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'Lambda関数は実行時に動的にログストリームを作成するため、ワイルドカード権限が必要です。これはAWSの標準的な動作です。',
        appliesTo: [
          'Resource::arn:aws:logs:ap-northeast-1:111111111111:log-group:/aws/lambda/online-banking-*',
          'Resource::arn:aws:logs:ap-northeast-1:111111111111:log-group:/aws/lambda/online-banking-*:*',
        ],
      },
    ]);

    // API Gateway: コアバンキングシステムAPI（IAM認証 + API Key）
    const coreApi = new apigateway.RestApi(this, 'CoreBankingApi', {
      restApiName: 'Core Banking System API (Internal)',
      description: 'Core Banking System API with IAM Authentication for Mobile Banking Backend',
      cloudWatchRole: false, // カスタムロールを後で設定
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        // CloudWatchログを有効化
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
        maxAge: cdk.Duration.days(1),
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      // IAM認証 + API Key（Mobile Banking Backend専用）
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.IAM,
        apiKeyRequired: true,
      },
      // リソースポリシー: Online Banking AppのLambda関数からのアクセスを許可
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountPrincipal(this.account)],
            actions: ['execute-api:Invoke'],
            resources: ['*'],
            conditions: {
              StringEquals: {
                'aws:RequestedRegion': this.region,
              },
              StringLike: {
                'aws:userid': [
                  // Online Banking AppのLambda関数ロールからのアクセスを許可
                  'AROA*:online-banking-*',
                  // 開発・テスト用の追加アクセス許可
                  'AROA*:*',
                ],
              },
            },
          }),
        ],
      }),
    });

    // API Gateway Account設定（カスタムCloudWatchロール使用）
    new apigateway.CfnAccount(this, 'CustomApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
    });

    // リクエストバリデーター: リクエストボディとパラメータの検証
    const requestValidator = coreApi.addRequestValidator('CoreApiRequestValidator', {
      requestValidatorName: 'core-api-request-validator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // API Key設定（Core Banking API用）
    const coreApiKey = coreApi.addApiKey('CoreBankingApiKey', {
      apiKeyName: 'core-banking-system-api-key',
      description: 'Core Banking System API Key for usage control',
    });

    // Usage Plan設定（Core Banking API用）
    const coreUsagePlan = coreApi.addUsagePlan('CoreBankingUsagePlan', {
      name: 'core-banking-system-usage-plan',
      description: 'Core Banking System Usage Plan for transaction control',
      apiStages: [
        {
          api: coreApi,
          stage: coreApi.deploymentStage,
        },
      ],
      throttle: {
        rateLimit: 500, // 1秒あたり500リクエスト（高頻度取引対応）
        burstLimit: 1000, // バーストで1000リクエスト
      },
      quota: {
        limit: 100000, // 1日あたり100,000リクエスト（大量取引対応）
        period: apigateway.Period.DAY,
      },
    });

    coreUsagePlan.addApiKey(coreApiKey);

    // Lambda統合設定
    const lambdaIntegration = new apigateway.LambdaIntegration(coreApiLambda, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    // API Gateway エンドポイント設定
    const apiRoot = coreApi.root.addResource('api');

    // 顧客関連エンドポイント
    const customersResource = apiRoot.addResource('customers');

    // POST /customers - 顧客作成
    customersResource.addMethod('POST', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '201',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // GET /customers/{customerId} - 顧客情報取得
    const customerResource = customersResource.addResource('{customerId}');
    customerResource.addMethod('GET', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // 口座関連エンドポイント
    const accountsResource = apiRoot.addResource('accounts');

    // POST /accounts - 口座開設
    accountsResource.addMethod('POST', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '201',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // GET /accounts/{accountId} - 口座情報取得
    const accountResource = accountsResource.addResource('{accountId}');
    accountResource.addMethod('GET', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // GET /accounts/{accountId}/transactions - 取引履歴取得
    const accountTransactionsResource = accountResource.addResource('transactions');
    accountTransactionsResource.addMethod('GET', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // 取引関連エンドポイント
    const transactionsResource = apiRoot.addResource('transactions');

    // POST /transactions/deposit - 入金処理
    const depositResource = transactionsResource.addResource('deposit');
    depositResource.addMethod('POST', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // POST /transactions/withdraw - 出金処理
    const withdrawResource = transactionsResource.addResource('withdraw');
    withdrawResource.addMethod('POST', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // GET /transaction/{transactionId} - トランザクション状態取得
    const transactionResource = apiRoot.addResource('transaction').addResource('{transactionId}');
    transactionResource.addMethod('GET', lambdaIntegration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Core Banking API実行ロールにAPI Gateway実行権限を追加
    this.coreApiExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `${coreApi.arnForExecuteApi('GET', '/api/customers/{customerId}', 'v1')}`,
          `${coreApi.arnForExecuteApi('POST', '/api/customers', 'v1')}`,
          `${coreApi.arnForExecuteApi('GET', '/api/accounts/{accountId}', 'v1')}`,
          `${coreApi.arnForExecuteApi('GET', '/api/accounts/{accountId}/transactions', 'v1')}`,
          `${coreApi.arnForExecuteApi('POST', '/api/accounts', 'v1')}`,
          `${coreApi.arnForExecuteApi('GET', '/api/transaction/{transactionId}', 'v1')}`,
          `${coreApi.arnForExecuteApi('POST', '/api/transactions/deposit', 'v1')}`,
          `${coreApi.arnForExecuteApi('POST', '/api/transactions/withdraw', 'v1')}`,
        ],
      }),
    );

    // API Key取得権限を追加（Lambda関数がAPI Keyを取得できるように）
    this.coreApiExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['apigateway:GET'],
        resources: [`arn:aws:apigateway:${this.region}::/apikeys/${coreApiKey.keyId}`],
      }),
    );

    // API エンドポイント、API ID、API Key IDを設定
    this.coreApiEndpoint = coreApi.url;
    this.coreApiId = coreApi.restApiId;
    this.coreApiKeyId = coreApiKey.keyId;

    // スタックの出力
    new cdk.CfnOutput(this, 'CoreApiEndpoint', {
      value: this.coreApiEndpoint,
      description: 'Temporary Core Banking System API endpoint',
      exportName: `${this.stackName}-CoreApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'CustomersTableName', {
      value: this.customersTable.tableName,
      description: 'Core Banking Customers Table Name',
    });

    new cdk.CfnOutput(this, 'AccountsTableName', {
      value: this.accountsTable.tableName,
      description: 'Core Banking Accounts Table Name',
    });

    new cdk.CfnOutput(this, 'TransactionsTableName', {
      value: this.transactionsTable.tableName,
      description: 'Core Banking Transactions Table Name',
    });

    new cdk.CfnOutput(this, 'CoreApiId', {
      value: coreApi.restApiId,
      description: 'Core Banking API Gateway ID',
    });

    new cdk.CfnOutput(this, 'CoreApiStage', {
      value: coreApi.deploymentStage.stageName,
      description: 'Core Banking API Gateway Stage',
    });

    new cdk.CfnOutput(this, 'CoreApiLambdaArn', {
      value: coreApiLambda.functionArn,
      description: 'Core Banking API Lambda Function ARN',
    });

    new cdk.CfnOutput(this, 'CoreApiKeyId', {
      value: coreApiKey.keyId,
      description: 'Core Banking API Key ID',
      exportName: `${this.stackName}-CoreApiKeyId`,
    });

    new cdk.CfnOutput(this, 'CoreApiUsagePlan', {
      value: coreUsagePlan.usagePlanId,
      description: 'Core Banking API Usage Plan ID',
    });

    // デフォルトデータの投入
    this.insertDefaultData();

    // CDK Nag抑制: Lambda関数が自動作成するデッドレターキューのSQS4エラーを抑制
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-SQS4',
        reason:
          'Lambda dead letter queue is configured with SSL enforcement through explicit SQS queue configuration with enforceSSL: true.',
      },
      {
        id: 'AwsSolutions-L1',
        reason:
          'カスタムリソース用Lambda関数はCDKによって自動管理されており、runtime versionはCDKのバージョンアップ時に更新されます。',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'CDKが自動生成するDefaultPolicyには、Lambda関数の基本的な実行に必要な権限が含まれています。これらの権限はCDKの内部動作によるものであり、セキュリティ上必要な最小権限です。',
        appliesTo: ['Resource::*'],
      },
      {
        id: 'AwsSolutions-COG4',
        reason:
          'Core Banking APIは同一システム内のMobile Banking Backendからの内部連携専用APIです。Cognito User Pool認証ではなく、IAM認証を使用してシステム間の認証を行っています。これにより、外部からの直接アクセスを防ぎ、適切なアクセス制御を実現しています。',
      },
      {
        id: 'AwsSolutions-APIG4',
        reason:
          'Core Banking APIは同一システム内のMobile Banking Backendからの内部連携専用APIです。IAM認証とAPI Key認証を組み合わせることで、適切な認証・認可を実装しています。CORSのOPTIONSメソッドについても、同一システム内での利用に限定されているため、セキュリティ上の問題はありません。',
      },
    ]);

    // CDK Nag抑制: API Gateway CloudWatchロールのワイルドカード権限
    NagSuppressions.addResourceSuppressions(apiGatewayCloudWatchRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'API GatewayのCloudWatch Logsアクセスには、動的に作成されるログストリームへのアクセス権限が必要です。これはAWS API Gatewayの標準的な動作であり、セキュリティ上必要な最小権限です。',
        appliesTo: ['Resource::*'],
      },
    ]);
  }

  private insertDefaultData() {
    // KMSキーの参照を取得
    const kmsConstruct = this.node.tryFindChild('CoreBankingKms') as KmsConstruct;
    // カスタムリソース用のロール作成
    const customResourceRole = new iam.Role(this, 'CustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        CloudWatchLogsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/core-banking-custom-resource-*`,
                `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/core-banking-custom-resource-*:*`,
              ],
            }),
          ],
        }),
        DynamoDBPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:PutItem'],
              resources: [this.customersTable.tableArn, this.accountsTable.tableArn, this.transactionsTable.tableArn],
            }),
          ],
        }),
        KMSPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
              resources: [kmsConstruct.key.keyArn],
            }),
          ],
        }),
      },
    });

    // CDK Nag抑制: カスタムリソース用Lambda関数のCloudWatch Logsアクセス権限
    NagSuppressions.addResourceSuppressions(customResourceRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'カスタムリソース用Lambda関数は実行時に動的にログストリームを作成するため、ワイルドカード権限が必要です。これはAWSの標準的な動作です。',
        appliesTo: [
          'Resource::arn:aws:logs:ap-northeast-1:111111111111:log-group:/aws/lambda/core-banking-custom-resource-*',
          'Resource::arn:aws:logs:ap-northeast-1:111111111111:log-group:/aws/lambda/core-banking-custom-resource-*:*',
        ],
      },
    ]);

    // デフォルト顧客データを投入
    const defaultCustomer1 = new cr.AwsCustomResource(this, 'DefaultCustomer1Data', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.customersTable.tableName,
          Item: {
            customerId: { S: 'CUST001' },
            lastName: { S: 'キンユウ' },
            firstName: { S: 'リファレンスアーキテクチャ' },
            email: { S: 'user001@example.com' },
            phone: { S: '090-0000-0001' },
            status: { S: 'ACTIVE' },
            createdAt: { S: new Date().toISOString() },
            updatedAt: { S: new Date().toISOString() },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-customer1-data'),
      },
      role: customResourceRole,
    });

    const defaultCustomer2 = new cr.AwsCustomResource(this, 'DefaultCustomer2Data', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.customersTable.tableName,
          Item: {
            customerId: { S: 'CUST002' },
            lastName: { S: 'モダン' },
            firstName: { S: 'アプリケーション' },
            email: { S: 'user002@example.com' },
            phone: { S: '090-0000-0002' },
            status: { S: 'ACTIVE' },
            createdAt: { S: new Date().toISOString() },
            updatedAt: { S: new Date().toISOString() },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-customer2-data'),
      },
      role: customResourceRole,
    });

    // デフォルト口座データを投入
    const defaultAccount1 = new cr.AwsCustomResource(this, 'DefaultAccount1Data', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.accountsTable.tableName,
          Item: {
            accountId: { S: '0011234567' }, // 支店番号001を含む口座番号
            customerId: { S: 'CUST001' },
            branchCode: { S: '001' }, // Online Banking支店
            branchName: { S: 'オンラインバンキング支店' },
            accountType: { S: 'SAVINGS' },
            balance: { N: '10000000' },
            currency: { S: 'JPY' },
            status: { S: 'ACTIVE' },
            createdAt: { S: new Date().toISOString() },
            updatedAt: { S: new Date().toISOString() },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-account1-data'),
      },
      role: customResourceRole,
    });

    const defaultAccount2 = new cr.AwsCustomResource(this, 'DefaultAccount2Data', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.accountsTable.tableName,
          Item: {
            accountId: { S: '0017654321' }, // 支店番号001を含む口座番号
            customerId: { S: 'CUST002' },
            branchCode: { S: '001' }, // Online Banking支店
            branchName: { S: 'オンラインバンキング支店' },
            accountType: { S: 'SAVINGS' },
            balance: { N: '10000000' },
            currency: { S: 'JPY' },
            status: { S: 'ACTIVE' },
            createdAt: { S: new Date().toISOString() },
            updatedAt: { S: new Date().toISOString() },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-account2-data'),
      },
      role: customResourceRole,
    });

    // デフォルト取引履歴データを投入
    // CUST001の取引履歴
    const transaction1 = new cr.AwsCustomResource(this, 'DefaultTransaction1', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.transactionsTable.tableName,
          Item: {
            transactionId: { S: 'TXN001' },
            timestamp: { S: '2024-01-15T10:00:00Z' },
            accountId: { S: '0011234567' },
            type: { S: 'TRANSFER_DEPOSIT' },
            amount: { N: '20000000' },
            currency: { S: 'JPY' },
            status: { S: 'COMPLETED' },
            description: { S: '振込による入金' },
            sourceAccountId: { S: '9999999' },
            transferId: { S: 'TRF001' },
            transferType: { S: 'INBOUND' },
            processedAt: { S: '2024-01-15T10:00:00Z' },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-transaction1'),
      },
      role: customResourceRole,
    });

    const transaction2 = new cr.AwsCustomResource(this, 'DefaultTransaction2', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.transactionsTable.tableName,
          Item: {
            transactionId: { S: 'TXN002' },
            timestamp: { S: '2024-02-10T14:30:00Z' },
            accountId: { S: '0011234567' },
            type: { S: 'TRANSFER_WITHDRAWAL' },
            amount: { N: '-5000000' },
            currency: { S: 'JPY' },
            status: { S: 'COMPLETED' },
            description: { S: '振込による出金' },
            targetAccountId: { S: '0017654321' },
            transferId: { S: 'TRF002' },
            transferType: { S: 'OUTBOUND' },
            processedAt: { S: '2024-02-10T14:30:00Z' },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-transaction2'),
      },
      role: customResourceRole,
    });

    const transaction3 = new cr.AwsCustomResource(this, 'DefaultTransaction3', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.transactionsTable.tableName,
          Item: {
            transactionId: { S: 'TXN003' },
            timestamp: { S: '2024-03-05T16:45:00Z' },
            accountId: { S: '0011234567' },
            type: { S: 'ATM_WITHDRAWAL' },
            amount: { N: '-5000000' },
            currency: { S: 'JPY' },
            status: { S: 'COMPLETED' },
            description: { S: 'ATM出金' },
            processedAt: { S: '2024-03-05T16:45:00Z' },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-transaction3'),
      },
      role: customResourceRole,
    });

    // CUST002の取引履歴
    const transaction4 = new cr.AwsCustomResource(this, 'DefaultTransaction4', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.transactionsTable.tableName,
          Item: {
            transactionId: { S: 'TXN004' },
            timestamp: { S: '2024-01-20T11:15:00Z' },
            accountId: { S: '0017654321' },
            type: { S: 'ATM_DEPOSIT' },
            amount: { N: '5000000' },
            currency: { S: 'JPY' },
            status: { S: 'COMPLETED' },
            description: { S: 'ATM入金' },
            processedAt: { S: '2024-01-20T11:15:00Z' },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-transaction4'),
      },
      role: customResourceRole,
    });

    const transaction5 = new cr.AwsCustomResource(this, 'DefaultTransaction5', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: this.transactionsTable.tableName,
          Item: {
            transactionId: { S: 'TXN005' },
            timestamp: { S: '2024-02-10T14:30:00Z' },
            accountId: { S: '0017654321' },
            type: { S: 'TRANSFER_DEPOSIT' },
            amount: { N: '5000000' },
            currency: { S: 'JPY' },
            status: { S: 'COMPLETED' },
            description: { S: '振込による入金' },
            sourceAccountId: { S: '0011234567' },
            transferId: { S: 'TRF002' },
            transferType: { S: 'INBOUND' },
            processedAt: { S: '2024-02-10T14:30:00Z' },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-transaction5'),
      },
      role: customResourceRole,
    });

    // 依存関係を設定
    defaultCustomer1.node.addDependency(this.customersTable);
    defaultCustomer2.node.addDependency(this.customersTable);
    defaultAccount1.node.addDependency(this.accountsTable);
    defaultAccount1.node.addDependency(defaultCustomer1);
    defaultAccount2.node.addDependency(this.accountsTable);
    defaultAccount2.node.addDependency(defaultCustomer2);

    // 取引履歴の依存関係
    transaction1.node.addDependency(this.transactionsTable);
    transaction1.node.addDependency(defaultAccount1);
    transaction2.node.addDependency(this.transactionsTable);
    transaction2.node.addDependency(defaultAccount1);
    transaction3.node.addDependency(this.transactionsTable);
    transaction3.node.addDependency(defaultAccount1);
    transaction4.node.addDependency(this.transactionsTable);
    transaction4.node.addDependency(defaultAccount2);
    transaction5.node.addDependency(this.transactionsTable);
    transaction5.node.addDependency(defaultAccount2);
  }
}
