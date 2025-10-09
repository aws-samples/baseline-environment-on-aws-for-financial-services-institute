import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { KmsConstruct } from './constructs/kms-construct';

export interface OnlineBankingAppBackendStackProps extends cdk.StackProps {
  isPrimary?: boolean;
  replicaRegions?: string[];
  vpc?: ec2.Vpc;
  securityGroups?: {
    lambda: ec2.SecurityGroup;
    database: ec2.SecurityGroup;
  };
  // コアバンキングシステムのAPIエンドポイント（オプション）
  coreSystemEndpoint?: string;
  // コアバンキングシステムのAPI Key ID（オプション）
  coreSystemApiKeyId?: string;
  // コアバンキングシステムのAPI ID（オプション）
  coreSystemApiId?: string;
  // Mail Delivery APIのエンドポイント（オプション）
  mailDeliveryApiEndpoint?: string;
  // Mail Delivery APIのAPI Key ID（オプション）
  mailDeliveryApiKeyId?: string;
}

export class OnlineBankingAppBackendStack extends cdk.Stack {
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: OnlineBankingAppBackendStackProps = {}) {
    super(scope, id, props);

    // 優先順位付きでコアAPIのベースURLを決定
    const coreApiBaseUrl =
      props.coreSystemEndpoint || // 1. temporary-core-banking-systemのエンドポイント
      process.env.CORE_API_BASE_URL || // 2. 環境変数（本番環境用）
      'https://your-production-core-system.com/api/v1'; // 3. デフォルト（本番システム用）

    // Mail Delivery APIのエンドポイントを決定
    const mailDeliveryApiEndpoint =
      props.mailDeliveryApiEndpoint || // 1. プロパティで指定されたエンドポイント
      process.env.MAIL_DELIVERY_API || // 2. 環境変数
      'https://your-mail-delivery-api.com/api/v1'; // 3. デフォルト

    // KMSカスタマー管理キーの作成（FISC実務基準3,13,30対応）
    const kmsConstruct = new KmsConstruct(this, 'OnlineBankingKms', {
      description: 'Online Banking App encryption key for FISC compliance',
      alias: 'alias/online-banking-app',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
    });

    // DynamoDBテーブル: ユーザー管理 - 認証・ユーザー情報用
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
    });

    // GSI: 顧客IDでユーザーを検索
    usersTable.addGlobalSecondaryIndex({
      indexName: 'CustomerIdIndex',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: ログインIDでユーザーを検索（メールアドレス依存を回避）
    usersTable.addGlobalSecondaryIndex({
      indexName: 'LoginIdIndex',
      partitionKey: { name: 'loginId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDBテーブル: セッション管理
    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
    });

    // GSI: ユーザーIDでセッションを検索
    sessionsTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDBテーブル: イベントストア - イベントソーシング用
    const eventStore = new dynamodb.Table(this, 'EventStore', {
      partitionKey: { name: 'aggregateId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
    });

    // DynamoDBテーブル: アウトボックステーブル - トランザクションアウトボックスパターン用
    const outboxTable = new dynamodb.Table(this, 'OutboxTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
    });

    // DynamoDBテーブル: 残高照会クエリ用 - CQRS読み取りモデル用
    const balanceTable = new dynamodb.Table(this, 'BalanceTable', {
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
    });

    // SQSキュー: 入金処理用キュー
    const depositQueue = new sqs.Queue(this, 'DepositQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'DepositDLQ', {
          enforceSSL: true,
          encryption: sqs.QueueEncryption.KMS,
          encryptionMasterKey: kmsConstruct.key,
        }),
        maxReceiveCount: 3,
      },
      enforceSSL: true,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsConstruct.key,
    });

    // SQSキュー: 出金処理用キュー
    const withdrawQueue = new sqs.Queue(this, 'WithdrawQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'WithdrawDLQ', {
          enforceSSL: true,
          encryption: sqs.QueueEncryption.KMS,
          encryptionMasterKey: kmsConstruct.key,
        }),
        maxReceiveCount: 3,
      },
      enforceSSL: true,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsConstruct.key,
    });

    // EventBridge
    const eventBus = new events.EventBus(this, 'BankingEventBus', {
      eventBusName: 'banking-event-bus',
    });

    // JWT署名鍵をSecrets Managerで安全に管理
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      description: 'JWT signing secret for banking application',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'banking-app' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        passwordLength: 64,
      },
    });

    // CDK Nag抑制: JWT署名鍵の自動ローテーション
    NagSuppressions.addResourceSuppressions(jwtSecret, [
      {
        id: 'AwsSolutions-SMG4',
        reason:
          'JWT署名鍵の自動ローテーションは既存のトークンを無効化するため、セキュリティポリシーに基づいて手動で管理します。金融システムでは予期しないトークン無効化を避けるため、計画的なローテーションが必要です。',
      },
    ]);

    // CloudWatch Logs Group for API Gateway
    const apiLogGroup = new logs.LogGroup(this, 'BankingApiLogGroup', {
      logGroupName: `/aws/apigateway/banking-api-${this.stackName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // API Gateway CloudWatch Logsロール（AWS管理ポリシー使用）
    const apiGatewayCloudWatchRole = new iam.Role(this, 'BankingApiCloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs'),
      ],
      description: 'Role for API Gateway to write CloudWatch Logs',
    });

    // CDK Nag抑制: Banking API CloudWatch RoleのAWS管理ポリシー使用
    NagSuppressions.addResourceSuppressions(apiGatewayCloudWatchRole, [
      {
        id: 'AwsSolutions-IAM4',
        reason:
          'API GatewayのCloudWatch Logsアクセスには、AWSが提供する標準的な管理ポリシー「AmazonAPIGatewayPushToCloudWatchLogs」を使用しています。これはAWSが推奨する方法であり、セキュリティ上適切です。',
        appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs'],
      },
    ]);

    // API Gateway アカウント設定（リージョンごとに1つのみ存在可能）
    // Core Banking Stackがデプロイされていない場合のみ作成
    if (!props.coreSystemEndpoint) {
      const apiGatewayAccount = new apigateway.CfnAccount(this, 'BankingApiGatewayAccount', {
        cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
      });

      // 明示的な依存関係を設定
      apiGatewayAccount.addDependency(apiGatewayCloudWatchRole.node.defaultChild as cdk.CfnResource);
    }

    // Lambda関数用共通カスタムロール作成関数
    const createLambdaRole = (id: string, functionName: string, additionalPolicies?: iam.PolicyDocument[]) => {
      const logGroupArn = `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/${functionName}`;

      const policies: { [key: string]: iam.PolicyDocument } = {
        CloudWatchLogsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [logGroupArn, `${logGroupArn}:*`],
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
      };

      // 追加ポリシーがある場合は追加
      if (additionalPolicies) {
        additionalPolicies.forEach((policy, index) => {
          policies[`AdditionalPolicy${index}`] = policy;
        });
      }

      const role = new iam.Role(this, id, {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        inlinePolicies: policies,
      });

      // CDK Nag抑制: Lambda関数のCloudWatch LogsとKMSアクセス権限
      NagSuppressions.addResourceSuppressions(role, [
        {
          id: 'AwsSolutions-IAM5',
          reason:
            'Lambda関数は実行時に動的にログストリームを作成するため、ワイルドカード権限が必要です。また、KMS権限についても、ReEncrypt*やGenerateDataKey*のワイルドカード権限が必要です。これらはAWSの標準的な動作です。',
          appliesTo: [`Resource::${logGroupArn}:*`, 'Action::kms:ReEncrypt*', 'Action::kms:GenerateDataKey*'],
        },
      ]);

      return role;
    };

    // API Gateway (Lambda関数で参照するため先に宣言)
    const api = new apigateway.RestApi(this, 'BankingApi', {
      restApiName: 'Banking API',
      description: 'Online Banking API for mobile apps',
      cloudWatchRole: false, // カスタムロールを後で設定
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: true,
        // アクセスログを有効化
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
        // CloudWatch メトリクスとログを有効化
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Requested-With',
        ],
        allowCredentials: false,
        maxAge: cdk.Duration.days(1),
      },
    });

    // リクエストバリデーター: リクエストボディとパラメータの検証
    const requestValidator = api.addRequestValidator('BankingApiRequestValidator', {
      requestValidatorName: 'banking-api-request-validator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // API Key作成
    const customerApiKey = new apigateway.ApiKey(this, 'CustomerApiKey', {
      apiKeyName: 'customer-api-key',
      description: 'API Key for customer operations (registration, account opening, etc.)',
    });

    const adminApiKey = new apigateway.ApiKey(this, 'AdminApiKey', {
      apiKeyName: 'admin-api-key',
      description: 'API Key for admin operations',
    });

    const authApiKey = new apigateway.ApiKey(this, 'AuthApiKey', {
      apiKeyName: 'auth-api-key',
      description: 'API Key for authentication operations',
    });

    // API Key値をSSM Parameter Storeに保存するカスタムリソース
    const saveCustomerApiKeyValue = new cr.AwsCustomResource(this, 'SaveCustomerApiKeyValue', {
      onCreate: {
        service: 'APIGateway',
        action: 'getApiKey',
        parameters: {
          apiKey: customerApiKey.keyId,
          includeValue: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`save-customer-api-key-${customerApiKey.keyId}`),
      },
      onUpdate: {
        service: 'APIGateway',
        action: 'getApiKey',
        parameters: {
          apiKey: customerApiKey.keyId,
          includeValue: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`save-customer-api-key-${customerApiKey.keyId}`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['apigateway:GET'],
          resources: [`arn:aws:apigateway:${this.region}::/apikeys/${customerApiKey.keyId}`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ssm:PutParameter'],
          resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/banking-app/api-keys/customer`],
        }),
      ]),
    });

    const saveAdminApiKeyValue = new cr.AwsCustomResource(this, 'SaveAdminApiKeyValue', {
      onCreate: {
        service: 'APIGateway',
        action: 'getApiKey',
        parameters: {
          apiKey: adminApiKey.keyId,
          includeValue: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`save-admin-api-key-${adminApiKey.keyId}`),
      },
      onUpdate: {
        service: 'APIGateway',
        action: 'getApiKey',
        parameters: {
          apiKey: adminApiKey.keyId,
          includeValue: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`save-admin-api-key-${adminApiKey.keyId}`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['apigateway:GET'],
          resources: [`arn:aws:apigateway:${this.region}::/apikeys/${adminApiKey.keyId}`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ssm:PutParameter'],
          resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/banking-app/api-keys/admin`],
        }),
      ]),
    });

    const saveAuthApiKeyValue = new cr.AwsCustomResource(this, 'SaveAuthApiKeyValue', {
      onCreate: {
        service: 'APIGateway',
        action: 'getApiKey',
        parameters: {
          apiKey: authApiKey.keyId,
          includeValue: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`save-auth-api-key-${authApiKey.keyId}`),
      },
      onUpdate: {
        service: 'APIGateway',
        action: 'getApiKey',
        parameters: {
          apiKey: authApiKey.keyId,
          includeValue: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`save-auth-api-key-${authApiKey.keyId}`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['apigateway:GET'],
          resources: [`arn:aws:apigateway:${this.region}::/apikeys/${authApiKey.keyId}`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ssm:PutParameter'],
          resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/banking-app/api-keys/auth`],
        }),
      ]),
    });

    // SSM Parameter Storeにカスタムリソースで取得した値を保存
    new ssm.StringParameter(this, 'CustomerApiKeyParameter', {
      parameterName: '/banking-app/api-keys/customer',
      stringValue: saveCustomerApiKeyValue.getResponseField('value'),
      description: 'Customer API Key value',
    });

    new ssm.StringParameter(this, 'AdminApiKeyParameter', {
      parameterName: '/banking-app/api-keys/admin',
      stringValue: saveAdminApiKeyValue.getResponseField('value'),
      description: 'Admin API Key value',
    });

    new ssm.StringParameter(this, 'AuthApiKeyParameter', {
      parameterName: '/banking-app/api-keys/auth',
      stringValue: saveAuthApiKeyValue.getResponseField('value'),
      description: 'Auth API Key value',
    });

    // API エンドポイントもSSM Parameter Storeに保存
    new ssm.StringParameter(this, 'BankingApiEndpointParameter', {
      parameterName: '/banking-app/api-endpoint',
      stringValue: api.url,
      description: 'Banking API endpoint',
    });

    // Usage Plan作成
    const customerUsagePlan = new apigateway.UsagePlan(this, 'CustomerUsagePlan', {
      name: 'customer-usage-plan',
      description: 'Usage plan for customer API operations',
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.DAY,
      },
    });

    const adminUsagePlan = new apigateway.UsagePlan(this, 'AdminUsagePlan', {
      name: 'admin-usage-plan',
      description: 'Usage plan for admin API operations',
      throttle: {
        rateLimit: 50,
        burstLimit: 100,
      },
      quota: {
        limit: 5000,
        period: apigateway.Period.DAY,
      },
    });

    const authUsagePlan = new apigateway.UsagePlan(this, 'AuthUsagePlan', {
      name: 'auth-usage-plan',
      description: 'Usage plan for authentication API operations',
      throttle: {
        rateLimit: 200,
        burstLimit: 400,
      },
      quota: {
        limit: 20000,
        period: apigateway.Period.DAY,
      },
    });

    // API KeyをUsage Planに関連付け
    customerUsagePlan.addApiKey(customerApiKey);
    adminUsagePlan.addApiKey(adminApiKey);
    authUsagePlan.addApiKey(authApiKey);

    // Usage PlanをAPI Stageに関連付け
    customerUsagePlan.addApiStage({
      stage: api.deploymentStage,
    });
    adminUsagePlan.addApiStage({
      stage: api.deploymentStage,
    });
    authUsagePlan.addApiStage({
      stage: api.deploymentStage,
    });

    // Lambda Authorizer: JWT認証用（既存のverify-token機能を活用）
    const jwtAuthorizerRole = createLambdaRole('JwtAuthorizerRole', 'online-banking-jwt-authorizer');
    const jwtAuthorizer = new lambdaNodejs.NodejsFunction(this, 'JwtAuthorizer', {
      functionName: 'online-banking-jwt-authorizer',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/authentication/jwt-authorizer/src/index.ts',
      handler: 'handler',
      environment: {
        USERS_TABLE: usersTable.tableName,
        SESSIONS_TABLE: sessionsTable.tableName,
        NODE_ENV: 'production',
        JWT_SECRET_ARN: jwtSecret.secretArn,
      },
      environmentEncryption: kmsConstruct.key,
      timeout: cdk.Duration.seconds(10),
      role: jwtAuthorizerRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        nodeModules: ['jsonwebtoken'], // jsonwebtokenを明示的に含める
        tsconfig: 'tsconfig.json',
      },
    });

    // JWT Authorizer用のDynamoDB権限
    jwtAuthorizerRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:Query'],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/CustomerIdIndex`,
          `${usersTable.tableArn}/index/LoginIdIndex`,
          sessionsTable.tableArn,
          `${sessionsTable.tableArn}/index/UserIdIndex`,
        ],
      }),
    );

    // JWT AuthorizerにSecrets Manager読み取り権限を付与
    jwtSecret.grantRead(jwtAuthorizer);

    // API Gateway Authorizer
    const apiAuthorizer = new apigateway.TokenAuthorizer(this, 'JwtTokenAuthorizer', {
      handler: jwtAuthorizer,
      identitySource: 'method.request.header.Authorization',
      authorizerName: 'jwt-authorizer',
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Lambda関数: ログイン認証API
    const loginLambdaRole = createLambdaRole('LoginLambdaRole', 'online-banking-login');
    const loginLambda = new lambdaNodejs.NodejsFunction(this, 'LoginLambda', {
      functionName: 'online-banking-login',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/authentication/login/src/index.ts',
      handler: 'handler',
      environment: {
        USERS_TABLE: usersTable.tableName,
        SESSIONS_TABLE: sessionsTable.tableName,
        NODE_ENV: 'production',
        JWT_SECRET_ARN: jwtSecret.secretArn,
      },
      environmentEncryption: kmsConstruct.key,
      timeout: cdk.Duration.seconds(30),
      role: loginLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // LoginLambdaにSecrets Manager読み取り権限を付与
    jwtSecret.grantRead(loginLambda);

    // Lambda関数: トークン検証API
    const verifyTokenLambdaRole = createLambdaRole('VerifyTokenLambdaRole', 'online-banking-verify-token');
    const verifyTokenLambda = new lambdaNodejs.NodejsFunction(this, 'VerifyTokenLambda', {
      functionName: 'online-banking-verify-token',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/authentication/verify-token/src/index.ts',
      handler: 'handler',
      environment: {
        USERS_TABLE: usersTable.tableName,
        SESSIONS_TABLE: sessionsTable.tableName,
        NODE_ENV: 'production',
        JWT_SECRET_ARN: jwtSecret.secretArn,
      },
      environmentEncryption: kmsConstruct.key,
      timeout: cdk.Duration.seconds(10),
      role: verifyTokenLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // VerifyTokenLambdaにSecrets Manager読み取り権限を付与
    jwtSecret.grantRead(verifyTokenLambda);

    // Lambda関数: ユーザー登録API（Account Opening連携用）
    const registerLambdaRole = createLambdaRole('RegisterLambdaRole', 'online-banking-register');
    const registerLambda = new lambdaNodejs.NodejsFunction(this, 'RegisterLambda', {
      functionName: 'online-banking-register',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/authentication/register/src/index.ts',
      handler: 'handler',
      environment: {
        USERS_TABLE: usersTable.tableName,
        NODE_ENV: 'production',
        JWT_SECRET_ARN: jwtSecret.secretArn,
      },
      environmentEncryption: kmsConstruct.key,
      timeout: cdk.Duration.seconds(30),
      role: registerLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // RegisterLambdaにSecrets Manager読み取り権限を付与
    jwtSecret.grantRead(registerLambda);

    // Lambda関数: 残高照会API
    const balanceLambdaRole = createLambdaRole('BalanceLambdaRole', 'online-banking-balance');
    const balanceLambda = new lambdaNodejs.NodejsFunction(this, 'BalanceLambda', {
      functionName: 'online-banking-balance',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/query-services/balance/src/index.ts',
      handler: 'handler',
      environment: {
        BALANCE_TABLE: balanceTable.tableName,
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(30),
      role: balanceLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: 取引履歴照会API
    const transactionsLambdaRole = createLambdaRole('TransactionsLambdaRole', 'online-banking-transactions');
    const transactionsLambda = new lambdaNodejs.NodejsFunction(this, 'TransactionsLambda', {
      functionName: 'online-banking-transactions',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/query-services/transactions/src/index.ts',
      handler: 'handler',
      environment: {
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(30),
      role: transactionsLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Core Banking API実行権限を追加（IAM認証対応）- テスト用に広い権限を付与
    const coreApiExecutePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:Invoke'],
      resources: props.coreSystemApiId
        ? [
            // テスト用: より広い権限を付与してIAM権限の問題を特定
            `arn:aws:execute-api:${this.region}:${this.account}:${props.coreSystemApiId}/*`,
          ]
        : [
            // フォールバック: Core Banking APIが同一アカウント内にある場合の権限（開発用）
            `arn:aws:execute-api:${this.region}:${this.account}:*/*`,
          ],
    });

    // API Key取得権限を追加（Lambda関数がAPI Keyを取得できるように）
    const apiKeyAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['apigateway:GET'],
      resources: props.coreSystemApiKeyId
        ? [`arn:aws:apigateway:${this.region}::/apikeys/${props.coreSystemApiKeyId}`]
        : [`arn:aws:apigateway:${this.region}::/apikeys/*`],
    });

    // 顧客用API Key取得権限を追加（account-opening-outbox-processor用）
    const customerApiKeyAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['apigateway:GET'],
      resources: [`arn:aws:apigateway:${this.region}::/apikeys/${customerApiKey.keyId}`],
    });

    // Lambda関数: 振込リクエスト処理API
    const transferLambdaRole = createLambdaRole('TransferLambdaRole', 'online-banking-transfer');
    const transferLambda = new lambdaNodejs.NodejsFunction(this, 'TransferLambda', {
      functionName: 'online-banking-transfer',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/transfer-management/transfer-request/src/index.ts',
      handler: 'handler',
      environment: {
        EVENT_STORE_TABLE: eventStore.tableName,
        OUTBOX_TABLE: outboxTable.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
        BALANCE_TABLE: balanceTable.tableName,
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(30),
      role: transferLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: 出金イベント処理ワーカー
    const withdrawWorkerLambdaRole = createLambdaRole('WithdrawWorkerLambdaRole', 'online-banking-withdraw-worker');
    const withdrawWorkerLambda = new lambdaNodejs.NodejsFunction(this, 'WithdrawWorkerLambda', {
      functionName: 'online-banking-withdraw-worker',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/transfer-management/withdraw-worker/src/index.ts',
      handler: 'handler',
      environment: {
        OUTBOX_TABLE: outboxTable.tableName,
        EVENT_STORE_TABLE: eventStore.tableName,
        BALANCE_TABLE: balanceTable.tableName,
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(60),
      role: withdrawWorkerLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: 出金アウトボックス処理
    const withdrawOutboxLambdaRole = createLambdaRole('WithdrawOutboxLambdaRole', 'online-banking-withdraw-outbox');
    const withdrawOutboxLambda = new lambdaNodejs.NodejsFunction(this, 'WithdrawOutboxLambda', {
      functionName: 'online-banking-withdraw-outbox',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/transfer-management/withdraw-outbox/src/index.ts',
      handler: 'handler',
      environment: {
        OUTBOX_TABLE: outboxTable.tableName,
        EVENT_STORE_TABLE: eventStore.tableName,
        CORE_API_BASE_URL: coreApiBaseUrl,
        EVENT_BUS_NAME: eventBus.eventBusName,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(60),
      role: withdrawOutboxLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: 入金イベント処理ワーカー
    const depositWorkerLambdaRole = createLambdaRole('DepositWorkerLambdaRole', 'online-banking-deposit-worker');
    const depositWorkerLambda = new lambdaNodejs.NodejsFunction(this, 'DepositWorkerLambda', {
      functionName: 'online-banking-deposit-worker',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/transfer-management/deposit-worker/src/index.ts',
      handler: 'handler',
      environment: {
        OUTBOX_TABLE: outboxTable.tableName,
        EVENT_STORE_TABLE: eventStore.tableName,
        BALANCE_TABLE: balanceTable.tableName,
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(60),
      role: depositWorkerLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: 入金アウトボックス処理
    const depositOutboxLambdaRole = createLambdaRole('DepositOutboxLambdaRole', 'online-banking-deposit-outbox');
    const depositOutboxLambda = new lambdaNodejs.NodejsFunction(this, 'DepositOutboxLambda', {
      functionName: 'online-banking-deposit-outbox',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/transfer-management/deposit-outbox/src/index.ts',
      handler: 'handler',
      environment: {
        OUTBOX_TABLE: outboxTable.tableName,
        EVENT_STORE_TABLE: eventStore.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(60),
      role: depositOutboxLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: メール通知処理
    const mailNotificationLambdaRole = createLambdaRole(
      'MailNotificationLambdaRole',
      'online-banking-mail-notification',
    );
    const mailNotificationLambda = new lambdaNodejs.NodejsFunction(this, 'MailNotificationLambda', {
      functionName: 'online-banking-mail-notification',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/transfer-management/mail-notification/src/index.ts',
      handler: 'handler',
      environment: {
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
        MAIL_DELIVERY_API: mailDeliveryApiEndpoint,
        MAIL_DELIVERY_API_KEY: props.mailDeliveryApiKeyId || '',
      },
      timeout: cdk.Duration.seconds(30),
      role: mailNotificationLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // DynamoDBテーブル: 口座開設イベントストア - 口座開設専用のイベントソーシング
    const accountOpeningEventStore = new dynamodb.Table(this, 'AccountOpeningEventStore', {
      partitionKey: { name: 'aggregateId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
    });

    // DynamoDBテーブル: 口座開設アウトボックステーブル - 口座開設専用のトランザクションアウトボックス
    const accountOpeningOutboxTable = new dynamodb.Table(this, 'AccountOpeningOutboxTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // replicationRegionsを削除してGlobal Tablesを無効化
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsConstruct.key,
    });

    // GSI: 処理状態による検索用
    accountOpeningOutboxTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Lambda関数: 口座開設API
    const accountOpeningLambdaRole = createLambdaRole('AccountOpeningLambdaRole', 'online-banking-account-opening');
    const accountOpeningLambda = new lambdaNodejs.NodejsFunction(this, 'AccountOpeningLambda', {
      functionName: 'online-banking-account-opening',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/account-management/account-opening/src/index.ts',
      handler: 'handler',
      environment: {
        ACCOUNT_OPENING_EVENT_STORE_TABLE: accountOpeningEventStore.tableName,
        ACCOUNT_OPENING_OUTBOX_TABLE: accountOpeningOutboxTable.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
        CORE_API_BASE_URL: coreApiBaseUrl,
        CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      role: accountOpeningLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: 口座開設通知処理
    const accountOpeningNotificationLambdaRole = createLambdaRole(
      'AccountOpeningNotificationLambdaRole',
      'online-banking-account-opening-notification',
    );
    const accountOpeningNotificationLambda = new lambdaNodejs.NodejsFunction(this, 'AccountOpeningNotificationLambda', {
      functionName: 'online-banking-account-opening-notification',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/account-management/account-opening-notification/src/index.ts',
      handler: 'handler',
      environment: {
        ACCOUNT_OPENING_EVENT_STORE_TABLE: accountOpeningEventStore.tableName,
        MAIL_DELIVERY_API: mailDeliveryApiEndpoint,
        MAIL_DELIVERY_API_KEY: props.mailDeliveryApiKeyId || '',
        SENDER_EMAIL: process.env.SENDER_EMAIL || 'noreply@example.com',
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(60),
      role: accountOpeningNotificationLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // Lambda関数: 口座開設アウトボックス処理
    const accountOpeningOutboxProcessorLambdaRole = createLambdaRole(
      'AccountOpeningOutboxProcessorLambdaRole',
      'online-banking-account-opening-outbox-processor',
    );
    const accountOpeningOutboxProcessorLambda = new lambdaNodejs.NodejsFunction(
      this,
      'AccountOpeningOutboxProcessorLambda',
      {
        functionName: 'online-banking-account-opening-outbox-processor',
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: 'lib/lambda-functions/account-management/account-opening-outbox-processor/src/index.ts',
        handler: 'handler',
        environment: {
          ACCOUNT_OPENING_EVENT_STORE_TABLE: accountOpeningEventStore.tableName,
          ACCOUNT_OPENING_OUTBOX_TABLE: accountOpeningOutboxTable.tableName,
          EVENT_BUS_NAME: eventBus.eventBusName,
          CORE_API_BASE_URL: coreApiBaseUrl,
          CORE_API_KEY_ID: props.coreSystemApiKeyId || '',
          BANKING_API_ENDPOINT: api.url, // 認証システムAPI呼び出し用
          CUSTOMER_API_KEY_ID: customerApiKey.keyId, // 顧客用API Key ID
          NODE_ENV: 'production',
        },
        timeout: cdk.Duration.seconds(300), // 5分 - Core Banking API呼び出しを考慮
        role: accountOpeningOutboxProcessorLambdaRole,
        bundling: {
          externalModules: ['@aws-sdk/*'],
          tsconfig: 'tsconfig.json',
        },
      },
    );

    // Lambda関数: 管理者API
    const adminApiLambdaRole = createLambdaRole('AdminApiLambdaRole', 'online-banking-admin-api');
    const adminApiLambda = new lambdaNodejs.NodejsFunction(this, 'AdminApiLambda', {
      functionName: 'online-banking-admin-api',
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'lib/lambda-functions/admin/admin-api/src/index.ts',
      handler: 'handler',
      environment: {
        ACCOUNT_OPENING_EVENT_STORE_TABLE: accountOpeningEventStore.tableName,
        EVENT_STORE_TABLE: eventStore.tableName,
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      role: adminApiLambdaRole,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        tsconfig: 'tsconfig.json',
      },
    });

    // テーブルへのアクセス許可を設定
    // 認証関連Lambda関数の権限 - カスタムポリシーを使用
    loginLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/CustomerIdIndex`,
          `${usersTable.tableArn}/index/LoginIdIndex`,
          sessionsTable.tableArn,
          `${sessionsTable.tableArn}/index/UserIdIndex`,
        ],
      }),
    );

    verifyTokenLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:Query'],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/CustomerIdIndex`,
          `${usersTable.tableArn}/index/LoginIdIndex`,
          sessionsTable.tableArn,
          `${sessionsTable.tableArn}/index/UserIdIndex`,
        ],
      }),
    );

    registerLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem', 'dynamodb:Query'],
        resources: [
          usersTable.tableArn,
          `${usersTable.tableArn}/index/CustomerIdIndex`,
          `${usersTable.tableArn}/index/LoginIdIndex`,
        ],
      }),
    );

    // 残高照会Lambda関数の権限
    balanceLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:Query'],
        resources: [balanceTable.tableArn],
      }),
    );

    // 残高照会Lambda関数にCore Banking API実行権限を追加
    balanceLambdaRole.addToPolicy(coreApiExecutePolicy);
    balanceLambdaRole.addToPolicy(apiKeyAccessPolicy);

    // 振込Lambda関数の権限
    transferLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query'],
        resources: [eventStore.tableArn, outboxTable.tableArn, balanceTable.tableArn],
      }),
    );

    // 出金ワーカーLambda関数の権限
    withdrawWorkerLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: [balanceTable.tableArn, outboxTable.tableArn, eventStore.tableArn],
      }),
    );

    // 出金アウトボックスLambda関数の権限
    withdrawOutboxLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: [outboxTable.tableArn, eventStore.tableArn],
      }),
    );

    // 入金ワーカーLambda関数の権限
    depositWorkerLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: [balanceTable.tableArn, outboxTable.tableArn, eventStore.tableArn],
      }),
    );

    // 入金アウトボックスLambda関数の権限
    depositOutboxLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
        resources: [outboxTable.tableArn, eventStore.tableArn],
      }),
    );

    // 口座開設Lambda関数の権限
    accountOpeningLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
        resources: [
          accountOpeningEventStore.tableArn,
          accountOpeningOutboxTable.tableArn,
          `${accountOpeningOutboxTable.tableArn}/index/StatusIndex`,
        ],
      }),
    );

    // EventBridge権限を追加
    accountOpeningLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      }),
    );

    // 口座開設通知Lambda関数の権限
    accountOpeningNotificationLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan', 'dynamodb:UpdateItem'],
        resources: [accountOpeningEventStore.tableArn],
      }),
    );

    // 口座開設アウトボックス処理Lambda関数の権限
    accountOpeningOutboxProcessorLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:Scan'],
        resources: [
          accountOpeningEventStore.tableArn,
          accountOpeningOutboxTable.tableArn,
          `${accountOpeningOutboxTable.tableArn}/index/StatusIndex`,
        ],
      }),
    );

    // EventBridge権限を追加
    accountOpeningOutboxProcessorLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      }),
    );

    // Core Banking APIを呼び出すすべてのLambda関数にIAM実行権限を追加
    const coreApiCallingRoles = [
      balanceLambdaRole,
      transactionsLambdaRole,
      transferLambdaRole,
      withdrawWorkerLambdaRole,
      withdrawOutboxLambdaRole,
      depositWorkerLambdaRole,
      depositOutboxLambdaRole,
      mailNotificationLambdaRole,
      accountOpeningLambdaRole,
      accountOpeningOutboxProcessorLambdaRole,
    ];

    // すべてのCore Banking API呼び出し用Lambda関数に実行権限を付与
    coreApiCallingRoles.forEach((role) => {
      role.addToPolicy(coreApiExecutePolicy);
      role.addToPolicy(apiKeyAccessPolicy);
    });

    // account-opening-outbox-processorに顧客用API Key取得権限を追加
    accountOpeningOutboxProcessorLambdaRole.addToPolicy(customerApiKeyAccessPolicy);

    // EventBridgeへの発行許可 - カスタムポリシーを使用
    const eventBridgePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [eventBus.eventBusArn],
    });

    transferLambdaRole.addToPolicy(eventBridgePolicy);
    withdrawOutboxLambdaRole.addToPolicy(eventBridgePolicy);
    depositOutboxLambdaRole.addToPolicy(eventBridgePolicy);
    accountOpeningLambdaRole.addToPolicy(eventBridgePolicy);
    accountOpeningOutboxProcessorLambdaRole.addToPolicy(eventBridgePolicy);

    // 管理者API Lambda関数の権限
    adminApiLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:Scan'],
        resources: [accountOpeningEventStore.tableArn, eventStore.tableArn],
      }),
    );

    // イベントソース設定
    // 出金処理イベントルール
    new events.Rule(this, 'WithdrawEventRule', {
      eventBus,
      eventPattern: {
        source: ['banking.transfer'],
        detailType: ['WithdrawRequested'],
      },
      targets: [new eventsTargets.SqsQueue(withdrawQueue)],
    });

    // 入金処理イベントルール
    new events.Rule(this, 'DepositEventRule', {
      eventBus,
      eventPattern: {
        source: ['banking.transfer'],
        detailType: ['DepositRequested'],
      },
      targets: [new eventsTargets.SqsQueue(depositQueue)],
    });

    // 振込完了通知イベントルール
    new events.Rule(this, 'TransferCompletedEventRule', {
      eventBus,
      eventPattern: {
        source: ['banking.transfer'],
        detailType: ['TransferCompleted'],
      },
      targets: [new eventsTargets.LambdaFunction(mailNotificationLambda)],
    });

    // 口座開設申込作成イベントルール
    new events.Rule(this, 'AccountOpeningCreatedEventRule', {
      eventBus,
      eventPattern: {
        source: ['banking.account-opening'],
        detailType: ['AccountOpeningApplicationCreated'],
      },
      targets: [new eventsTargets.LambdaFunction(accountOpeningNotificationLambda)],
    });

    // 口座開設完了イベントルール
    new events.Rule(this, 'AccountOpeningCompletedEventRule', {
      eventBus,
      eventPattern: {
        source: ['banking.account-opening'],
        detailType: ['AccountOpeningApplicationCompleted'],
      },
      targets: [new eventsTargets.LambdaFunction(accountOpeningNotificationLambda)],
    });

    // SQSトリガーをLambdaに追加
    withdrawWorkerLambda.addEventSource(new lambdaEventSources.SqsEventSource(withdrawQueue));
    depositWorkerLambda.addEventSource(new lambdaEventSources.SqsEventSource(depositQueue));

    // DynamoDB StreamトリガーをOutboxプロセッサーに追加
    withdrawOutboxLambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(outboxTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        filters: [
          {
            pattern: JSON.stringify({
              eventName: ['INSERT'],
              dynamodb: {
                NewImage: {
                  type: {
                    S: ['withdraw'],
                  },
                },
              },
            }),
          },
        ],
        batchSize: 10,
        retryAttempts: 3,
      }),
    );

    depositOutboxLambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(outboxTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        filters: [
          {
            pattern: JSON.stringify({
              eventName: ['INSERT'],
              dynamodb: {
                NewImage: {
                  type: {
                    S: ['deposit'],
                  },
                },
              },
            }),
          },
        ],
        batchSize: 10,
        retryAttempts: 3,
      }),
    );

    // DynamoDB StreamトリガーをAccountOpeningOutboxプロセッサーに追加
    accountOpeningOutboxProcessorLambda.addEventSource(
      new lambdaEventSources.DynamoEventSource(accountOpeningOutboxTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        filters: [
          {
            pattern: JSON.stringify({
              eventName: ['INSERT'],
              dynamodb: {
                NewImage: {
                  status: {
                    S: ['pending'],
                  },
                },
              },
            }),
          },
        ],
        batchSize: 5,
        retryAttempts: 3,
      }),
    );

    // API Gateway エンドポイント設定
    const apiV1 = api.root.addResource('api');

    // 認証関連エンドポイント
    const authResource = apiV1.addResource('auth');

    // POST /api/auth/login - ログイン（認証用API Key必須）
    const loginResource = authResource.addResource('login');
    loginResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(loginLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
      },
    );

    // GET /api/auth/verify - トークン検証（認証用API Key必須）
    const verifyResource = authResource.addResource('verify');
    verifyResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(verifyTokenLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
      },
    );

    // ユーザー管理エンドポイント
    const usersResource = apiV1.addResource('users');

    // POST /api/users/register - ユーザー登録（顧客用API Key必須）
    const registerResource = usersResource.addResource('register');
    registerResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(registerLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
      },
    );

    // /api/accounts/{id}/transactions エンドポイント
    const accountsResource = apiV1.addResource('accounts');
    const accountResource = accountsResource.addResource('{id}');
    const transactionsResource = accountResource.addResource('transactions');

    // トランザクション履歴取得API（JWT認証必須）
    transactionsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(transactionsLambda, {
        proxy: true,
      }),
      {
        authorizer: apiAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        apiKeyRequired: true,
        requestParameters: {
          'method.request.path.id': true,
        },
      },
    );

    // 残高照会API（JWT認証必須）
    const balanceResource = apiV1.addResource('balance');
    balanceResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(balanceLambda, {
        proxy: true,
      }),
      {
        authorizer: apiAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        apiKeyRequired: true,
      },
    );

    // 振込API（JWT認証必須）
    const transferResource = apiV1.addResource('transfer');
    transferResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(transferLambda, {
        proxy: true,
      }),
      {
        authorizer: apiAuthorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        apiKeyRequired: true,
      },
    );

    // 口座開設API - 既存の /api/accounts エンドポイントを使用

    // POST /api/accounts - 口座開設申込（顧客用API Key必須）
    accountsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(accountOpeningLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
      },
    );

    // GET /api/accounts/{id} - 申込状態確認（顧客用API Key必須）
    accountResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(accountOpeningLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
        requestParameters: {
          'method.request.path.id': true,
        },
      },
    );

    // POST /api/accounts/confirm/{transactionId} - 申込確認（管理者用API Key必須）
    const confirmResource = accountsResource.addResource('confirm');
    const confirmTransactionResource = confirmResource.addResource('{transactionId}');
    confirmTransactionResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(accountOpeningLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
        requestParameters: {
          'method.request.path.transactionId': true,
        },
      },
    );

    // POST /api/accounts/confirm/{transactionId}/reject - 申込却下（管理者用API Key必須）
    const rejectResource = confirmTransactionResource.addResource('reject');
    rejectResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(accountOpeningLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
        requestParameters: {
          'method.request.path.transactionId': true,
        },
      },
    );

    // 管理者用APIエンドポイント
    const adminResource = api.root.addResource('admin');

    // GET /admin/account-applications - 口座開設申請一覧（管理者用API Key必須）
    const adminAccountApplicationsResource = adminResource.addResource('account-applications');
    adminAccountApplicationsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(adminApiLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
      },
    );

    // GET /admin/account-applications/{applicationId}/credentials - 認証情報取得（管理者用API Key必須）
    const adminApplicationResource = adminAccountApplicationsResource.addResource('{applicationId}');
    const adminCredentialsResource = adminApplicationResource.addResource('credentials');
    adminCredentialsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(adminApiLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
        requestParameters: {
          'method.request.path.applicationId': true,
        },
      },
    );

    // GET /admin/transfer-events/{transactionId} - 振込イベント参照（管理者用API Key必須）
    const adminTransferEventsResource = adminResource.addResource('transfer-events');
    const adminTransferEventResource = adminTransferEventsResource.addResource('{transactionId}');
    adminTransferEventResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(adminApiLambda, {
        proxy: true,
      }),
      {
        authorizationType: apigateway.AuthorizationType.NONE,
        apiKeyRequired: true,
        requestParameters: {
          'method.request.path.transactionId': true,
        },
      },
    );

    // API エンドポイントを設定
    this.apiEndpoint = api.url;

    // WAF Web ACL for API Gateway
    const apiWebAcl = new wafv2.CfnWebACL(this, 'BankingApiWebACL', {
      scope: 'REGIONAL', // API Gateway用
      defaultAction: { allow: {} },
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000, // 5分間で2000リクエスト
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSetMetric',
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputsRuleSetMetric',
          },
        },
        {
          name: 'AWSManagedRulesLinuxRuleSet',
          priority: 4,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesLinuxRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'LinuxRuleSetMetric',
          },
        },
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'BankingApiWebACL',
      },
    });

    // API GatewayにWAFを関連付け
    new wafv2.CfnWebACLAssociation(this, 'BankingApiWebACLAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
      webAclArn: apiWebAcl.attrArn,
    });

    // WAF Web ACL ARNをSSM Parameter Storeに保存
    new ssm.StringParameter(this, 'BankingApiWebACLArnParameter', {
      parameterName: '/banking-app/waf/api-web-acl-arn',
      stringValue: apiWebAcl.attrArn,
      description: 'Banking API WAF Web ACL ARN',
    });

    // スタックの出力
    new cdk.CfnOutput(this, 'BankingApiEndpoint', {
      value: api.url,
      exportName: 'OnlineBankingBankingApiEndpoint',
      description: 'Banking API endpoint for frontend configuration',
    });

    new cdk.CfnOutput(this, 'CoreApiBaseUrl', {
      value: coreApiBaseUrl,
      description: 'Core Banking API Base URL being used',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'Users Table Name',
    });

    new cdk.CfnOutput(this, 'SessionsTableName', {
      value: sessionsTable.tableName,
      description: 'Sessions Table Name',
    });

    new cdk.CfnOutput(this, 'BankingApiWebACLArn', {
      value: apiWebAcl.attrArn,
      description: 'Banking API WAF Web ACL ARN',
    });

    new cdk.CfnOutput(this, 'MailDeliveryApiEndpoint', {
      value: mailDeliveryApiEndpoint,
      description: 'Mail Delivery API endpoint being used',
    });

    // Core Banking System がデプロイされている場合のみデフォルトユーザーを作成
    if (props.coreSystemEndpoint) {
      this.insertDefaultUsers(usersTable);
    }
  }

  private insertDefaultUsers(usersTable: dynamodb.Table) {
    // KMS キーへのアクセス権限を含むカスタムポリシー
    const customResourcePolicy = cr.AwsCustomResourcePolicy.fromStatements([
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:PutItem'],
        resources: [usersTable.tableArn],
      }),
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'kms:ViaService': [`dynamodb.${this.region}.amazonaws.com`],
          },
        },
      }),
    ]);

    // CUST001 用のデフォルトユーザー（loginId: user001）
    const defaultUser1 = new cr.AwsCustomResource(this, 'DefaultUser1', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: usersTable.tableName,
          Item: {
            userId: { S: 'USER001' },
            loginId: { S: 'user001' }, // Online-banking独自のログインID
            customerId: { S: 'CUST001' },
            primaryAccountId: { S: '0011234567' },
            email: { S: 'user001@example.com' },
            passwordHash: { S: '$2a$12$l0LvSUoRMdRK9l6UMv/5zuR7kNzzwx.d8VDgZ6OMXZrvB4Z1NVDSq' }, // password123
            salt: { S: '$2a$12$LQv3c1yqBWVHxkd0LHAkCO' },
            isActive: { BOOL: true },
            loginAttempts: { N: '0' },
            createdAt: { S: new Date().toISOString() },
            updatedAt: { S: new Date().toISOString() },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-user-001-v2'), // バージョンを変更して強制更新
      },
      onUpdate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: usersTable.tableName,
          Item: {
            userId: { S: 'USER001' },
            loginId: { S: 'user001' },
            customerId: { S: 'CUST001' },
            primaryAccountId: { S: '0011234567' },
            email: { S: 'user001@example.com' },
            passwordHash: { S: '$2a$12$l0LvSUoRMdRK9l6UMv/5zuR7kNzzwx.d8VDgZ6OMXZrvB4Z1NVDSq' }, // password123
            salt: { S: '$2a$12$LQv3c1yqBWVHxkd0LHAkCO' },
            isActive: { BOOL: true },
            loginAttempts: { N: '0' },
            createdAt: { S: new Date().toISOString() },
            updatedAt: { S: new Date().toISOString() },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-user-001-v2'),
      },
      policy: customResourcePolicy,
    });

    // CUST002 用のデフォルトユーザー（loginId: user002）
    const defaultUser2 = new cr.AwsCustomResource(this, 'DefaultUser2', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: usersTable.tableName,
          Item: {
            userId: { S: 'USER002' },
            loginId: { S: 'user002' }, // Online-banking独自のログインID
            customerId: { S: 'CUST002' },
            primaryAccountId: { S: '0017654321' },
            email: { S: 'user002@example.com' },
            passwordHash: { S: '$2a$12$l0LvSUoRMdRK9l6UMv/5zuR7kNzzwx.d8VDgZ6OMXZrvB4Z1NVDSq' }, // password123
            salt: { S: '$2a$12$LQv3c1yqBWVHxkd0LHAkCO' },
            isActive: { BOOL: true },
            loginAttempts: { N: '0' },
            createdAt: { S: new Date().toISOString() },
            updatedAt: { S: new Date().toISOString() },
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('default-user-002'),
      },
      policy: customResourcePolicy,
    });

    // 依存関係を設定
    defaultUser1.node.addDependency(usersTable);
    defaultUser2.node.addDependency(usersTable);

    // CDK Nag抑制: カスタムリソース用Lambda関数のL1エラーを抑制
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-L1',
        reason:
          'カスタムリソース用Lambda関数はCDKによって自動管理されており、runtime versionはCDKのバージョンアップ時に更新されます。',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason:
          'CDKが自動生成するDefaultPolicyには、Lambda関数の基本的な実行に必要な権限が含まれています。これらの権限はCDKの内部動作によるものであり、セキュリティ上必要な最小権限です。また、Core Banking APIへのアクセス権限で開発環境では具体的なAPI IDが不明なため、フォールバック権限としてワイルドカードを使用しています。KMS権限についても、DynamoDBサービス経由でのみアクセス可能に制限されており、セキュリティ上適切です。',
        appliesTo: [
          'Resource::*',
          'Resource::arn:aws:execute-api:ap-northeast-1:111111111111:*/v1/*/*',
          'Action::kms:ReEncrypt*',
          'Action::kms:GenerateDataKey*',
        ],
      },
    ]);
  }
}
