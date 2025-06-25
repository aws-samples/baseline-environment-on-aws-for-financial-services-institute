import { Auth } from './auth';
import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import * as nag_suppressions from '../../nag-suppressions';
import { NagSuppressions } from 'cdk-nag';

export interface Props {
  auth: Auth;
}

export class Api extends Construct {
  readonly arn: string;
  readonly graphqlUrl: string;
  readonly tableName: string;
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    /*
     * TODO: contactId とユーザーが連携されていないため、Cognito 認証済みユーザーであれば誰でも全 ContactId データを取得可能
     * この問題を解決するためには、Cognito ユーザーと ContactId を紐付ける必要がある
     *
     * 解決策ステップ：
     * 1. EventBridge を利用して Connect agent ID と ContactId を DynamoDB に保管
     * 2. Cognito ユーザーと Connect agent ID の紐付け。。。最も安易な実装は、Cognito ユーザーの属性に Connect agent ID を追加すること
     * 3. API リクエスト時に Cognito ユーザーの属性を参照し、Connect agent ID を取得、DynamoDB から ContactId を取得する
     */

    /*
     * DynamoDB テーブルを作成
     */
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // transcript をクエリするための GSI
    table.addGlobalSecondaryIndex({
      indexName: 'transcript_index',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'begin',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // bot, contact をクエリするための GSI
    table.addGlobalSecondaryIndex({
      indexName: 'type_index',
      partitionKey: {
        name: 'type',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
    });

    /**
     * GraphQL API を作成
     */
    const api = new appsync.GraphqlApi(this, 'GraphQLApi', {
      name: 'call-process-app-api',
      definition: appsync.Definition.fromFile(path.resolve(__dirname, '../graphql/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.auth.userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
    });
    nag_suppressions.addNagSuppressionsToGraphqlApi(api);

    /**
     * Bedrock によるコンプライアンス確認を実行する関数
     * GraphQL API から呼び出される
     */
    const bedrockCheckTranscriptLambda = new NodejsFunction(this, 'BedrockCheckTranscriptLambda', {
      functionName: 'bedrock-check-transcript',
      architecture: lambda.Architecture.X86_64,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        GRAPHQL_URL: api.graphqlUrl,
        TABLE_NAME: table.tableName,
        LOG_LEVEL: 'INFO',
      },
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.resolve(__dirname, './lambda/bedrock-check-transcript.ts'),
      timeout: Duration.seconds(60),
    });
    bedrockCheckTranscriptLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:invokeModel'],
        effect: iam.Effect.ALLOW,
        resources: ['*'], // モデルを限定しないため、リソースを * に設定
      }),
    );
    table.grantReadWriteData(bedrockCheckTranscriptLambda);
    // GSI へのクエリは grantReadWriteData に含まれないため明示的に権限を追加
    bedrockCheckTranscriptLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${table.tableArn}/index/*`],
      }),
    );
    nag_suppressions.addNagSuppressionsToLambda(bedrockCheckTranscriptLambda);
    NagSuppressions.addResourceSuppressions(
      bedrockCheckTranscriptLambda,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'BedrockCheckTranscriptLambda requires wildcard permission to access Bedrock and DynamoDB table',
        },
      ],
      true,
    );

    /**
     * Lambda データソースを作成
     * リゾルバからのリクエストを処理する Lambda 関数であり、GraphQL API の実装に該当
     */
    const resolverFunction = new NodejsFunction(this, 'ResolverFunction', {
      entry: path.resolve(__dirname, '../graphql/resolver.ts'),
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        TABLE_NAME: table.tableName,
        CHECK_TRANSCRIPT_FUNCTION_ARN: bedrockCheckTranscriptLambda.functionArn,
        LOG_LEVEL: 'INFO',
      },
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: Duration.seconds(70),
    });
    resolverFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        effect: iam.Effect.ALLOW,
        resources: [bedrockCheckTranscriptLambda.functionArn],
      }),
    );
    table.grantReadWriteData(resolverFunction);
    // GSI へのクエリは grantReadWriteData に含まれないため明示的に権限を追加
    resolverFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${table.tableArn}/index/*`],
      }),
    );
    nag_suppressions.addNagSuppressionsToLambda(resolverFunction);
    NagSuppressions.addResourceSuppressions(
      resolverFunction,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'ResolverFunction requires wildcard permission to access DynamoDB table',
        },
      ],
      true,
    );

    /**
     * AppSync の Lambda データソースを作成
     * DynamoDB データソースを作成することも可能だが、カスタマイズの可能性と開発効率を考慮して Lambda データソースを選択
     */
    const lambdaDataSource = api.addLambdaDataSource('LambdaDataSource', resolverFunction);
    NagSuppressions.addResourceSuppressions(
      lambdaDataSource,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'The service role of LambdaDataSource requires wildcard permission',
        },
      ],
      true,
    );

    /**
     * AddTranscript API （リゾルバ）を作成
     * トランスクリプトの追加を行う
     * フロントエンドはこの API を subscribe し、トランスクリプトデータを取得する
     */
    lambdaDataSource.createResolver('AddTranscriptResolver', {
      typeName: 'Mutation',
      fieldName: 'addTranscript',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * GetTranscripts API （リゾルバ）を作成
     */
    lambdaDataSource.createResolver('GetTranscriptsResolver', {
      typeName: 'Query',
      fieldName: 'getTranscripts',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * AddContact API （リゾルバ）を作成
     * Contact の追加・編集を行う
     */
    lambdaDataSource.createResolver('AddContactResolver', {
      typeName: 'Mutation',
      fieldName: 'addContact',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * GetContact API （リゾルバ）を作成
     */
    lambdaDataSource.createResolver('GetContactResolver', {
      typeName: 'Query',
      fieldName: 'getContact',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * GetContacts API （リゾルバ）を作成
     */
    lambdaDataSource.createResolver('GetContactsResolver', {
      typeName: 'Query',
      fieldName: 'getContacts',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * AddAssign API （リゾルバ）を作成
     * Assign (コンタクト ID に紐づくエージェントの情報) の追加・編集を行う
     */
    lambdaDataSource.createResolver('AddAssignResolver', {
      typeName: 'Mutation',
      fieldName: 'addAssign',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * GetAssigns API （リゾルバ）を作成
     */
    lambdaDataSource.createResolver('GetAssignsResolver', {
      typeName: 'Query',
      fieldName: 'getAssigns',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * AddSummary API （リゾルバ）を作成
     * Contact に Summary を追加する
     * Lambda 関数の bedrock-summary.ts から mutate される
     * フロントエンドはこの API を subscribe し summary データを取得するため、addContact API とは別 API として実装
     */
    lambdaDataSource.createResolver('AddSummaryResolver', {
      typeName: 'Mutation',
      fieldName: 'addSummary',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * CheckTranscript API （リゾルバ）を作成
     * Bedrock によるコンプライアンスチェックを実行する
     */
    lambdaDataSource.createResolver('CheckTranscriptResolver', {
      typeName: 'Mutation',
      fieldName: 'checkTranscript',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * AddBot API （リゾルバ）を作成
     * コンプライアンスチェック Bot の追加・編集を行う
     */
    lambdaDataSource.createResolver('AddBotResolver', {
      typeName: 'Mutation',
      fieldName: 'addBot',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * DeleteBot API （リゾルバ）を作成
     * コンプライアンスチェック Bot の削除を行う
     */
    lambdaDataSource.createResolver('DeleteBotResolver', {
      typeName: 'Mutation',
      fieldName: 'deleteBot',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    /**
     * GetBots API （リゾルバ）を作成
     */
    lambdaDataSource.createResolver('GetBotsResolver', {
      typeName: 'Query',
      fieldName: 'getBots',
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    this.arn = api.arn;
    this.graphqlUrl = api.graphqlUrl;
    this.tableName = table.tableName;
    new CfnOutput(this, 'GraphQLApiUrl', { value: api.graphqlUrl });
  }
}
