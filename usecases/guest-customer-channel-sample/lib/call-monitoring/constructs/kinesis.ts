import { Api } from './api';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as events from 'aws-cdk-lib/aws-events';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
// import * as kinesisfirehose_alpha from '@aws-cdk/aws-kinesisfirehose-alpha';
// import * as kinesisfirehosedestinations_alpha from '@aws-cdk/aws-kinesisfirehose-destinations-alpha';
// import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';
import * as connect_l2 from '../../connect-l2';
import * as nag_suppressions from '../../nag-suppressions';
import { NagSuppressions } from 'cdk-nag';

export interface Props {
  connectInstance: connect_l2.IInstance;
  api: Api;
}

export class Kinesis extends Construct {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const connectInstanceArn = props.connectInstance.instanceArn;

    // cdk.json から kinesisStreamArn を取得
    const kinesisStreamArn = this.node.tryGetContext('kinesisStreamArn') ?? '';
    let kinesisStream = kinesisStreamArn ? kinesis.Stream.fromStreamArn(this, 'KinesisStream', kinesisStreamArn) : null;

    const table = dynamodb.Table.fromTableName(this, 'Table', props.api.tableName);

    if (!kinesisStream) {
      // kinesis stream の作成
      kinesisStream = new kinesis.Stream(this, 'KinesisStream', {
        streamName: 'connect-analytics-stream',
        streamMode: kinesis.StreamMode.ON_DEMAND,
        removalPolicy: RemovalPolicy.DESTROY,
      });

      // Amazon connect と Kinesis Stream の連携付けを行う
      // https://docs.aws.amazon.com/ja_jp/connect/latest/adminguide/enable-contact-analysis-segment-streams.html
      new connect_l2.KinesisStorageConfig(this, 'InstanceStorageConfig', {
        instance: props.connectInstance,
        resourceType: connect_l2.ResourceType.REAL_TIME_CONTACT_ANALYSIS_VOICE_SEGMENTS,
        stream: kinesisStream,
      });

      // S3 にデータを保存する場合は、以下のコメントアウトを解除してください
      /* 
      // Kinesis Stream のデータを保存する S3 バケットの作成
      const destinationBucket = new s3.Bucket(this, 'DataBucket', {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });

      // Kinesis Firehose による S3 へのデータ転送
      new kinesisfirehose_alpha.DeliveryStream(this, 'KinesisFirehoseStream', {
        sourceStream: kinesisStream,
        destinations: [new kinesisfirehosedestinations_alpha.S3Bucket(destinationBucket)],
      });
      */
    }

    /**
     * kinesis-process.ts から Invoke される Lambda 関数を作成
     * Bedrock による要約を実行する
     */
    const bedrockSummaryLambda = new NodejsFunction(this, 'BedrockSummaryLambda', {
      functionName: 'bedrock-summary',
      architecture: lambda.Architecture.X86_64,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        TABLE_NAME: props.api.tableName,
        GRAPHQL_URL: props.api.graphqlUrl,
        LOG_LEVEL: 'INFO',
      },
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.resolve(__dirname, 'lambda/bedrock-summary.ts'),
      timeout: Duration.seconds(60),
    });
    bedrockSummaryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:invokeModel'],
        effect: iam.Effect.ALLOW,
        resources: ['*'], // モデルを限定しないため、リソースを * に設定
      }),
    );
    bedrockSummaryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:GraphQL'],
        effect: iam.Effect.ALLOW,
        resources: [`${props.api.arn}/*`],
      }),
    );
    table.grantReadWriteData(bedrockSummaryLambda);
    // GSI へのクエリは grantReadWriteData に含まれないため明示的に権限を追加
    bedrockSummaryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${table.tableArn}/index/*`],
      }),
    );
    nag_suppressions.addNagSuppressionsToLambda(bedrockSummaryLambda);
    NagSuppressions.addResourceSuppressions(
      bedrockSummaryLambda,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'BedrockSummaryLambda requires wildcard permission to access Bedrock, AppSync, and DynamoDB table',
        },
      ],
      true,
    );

    /**
     * Kinesis Stream から Invoke される Lambda 関数を作成
     * Kinesis Stream から受け取った データを AppSync にデータを送信 (mutate) する
     * フロントエンドは AppSync に対して subscribe し、データを取得する
     * また、Bedrock による要約を実行する Lambda 関数を呼び出す
     */
    const kinesisProcessLambda = new NodejsFunction(this, 'KinesisProcessLambda', {
      functionName: 'kinesis-process',
      architecture: lambda.Architecture.X86_64,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      events: [
        new lambdaEventSources.KinesisEventSource(kinesisStream, {
          startingPosition: lambda.StartingPosition.LATEST,
        }),
      ],
      environment: {
        GRAPHQL_URL: props.api.graphqlUrl,
        SUMMARY_FUNCTION_ARN: bedrockSummaryLambda.functionArn,
        LOG_LEVEL: 'INFO',
      },
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.resolve(__dirname, 'lambda/kinesis-process.ts'),
      timeout: Duration.seconds(10),
    });
    kinesisProcessLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:GraphQL'],
        effect: iam.Effect.ALLOW,
        resources: [`${props.api.arn}/*`],
      }),
    );
    kinesisProcessLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        effect: iam.Effect.ALLOW,
        resources: [bedrockSummaryLambda.functionArn],
      }),
    );
    nag_suppressions.addNagSuppressionsToLambda(kinesisProcessLambda);
    NagSuppressions.addResourceSuppressions(
      kinesisProcessLambda,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'ConnectEventProcessLambda requires wildcard permission to access AppSync',
        },
      ],
      true,
    );

    /**
     * EventBridge ルールから呼び出される Lambda 関数を作成
     * Kinesis Stream にデータを送信する
     */
    const connectEventProcessLambda = new NodejsFunction(this, 'ConnectEventProcessLambda', {
      functionName: 'connect-event-process',
      architecture: lambda.Architecture.X86_64,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
      environment: {
        TABLE_NAME: props.api.tableName,
        STREAM_NAME: kinesisStream.streamName,
        TIMEOUT: '20000',
        LOG_LEVEL: 'INFO',
      },
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.resolve(__dirname, 'lambda/connect-event-process.ts'),
      timeout: Duration.seconds(40),
    });
    connectEventProcessLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kinesis:PutRecord'],
        effect: iam.Effect.ALLOW,
        resources: [kinesisStream.streamArn],
      }),
    );
    connectEventProcessLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['connect:DescribeUser'],
        effect: iam.Effect.ALLOW,
        resources: [`${connectInstanceArn}/agent/*`],
      }),
    );
    table.grantReadData(connectEventProcessLambda);
    nag_suppressions.addNagSuppressionsToLambda(connectEventProcessLambda);
    NagSuppressions.addResourceSuppressions(
      connectEventProcessLambda,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'ConnectEventProcessLambda requires wildcard permission to access Amazon Connect',
        },
      ],
      true,
    );

    /**
     * Amazon Connect 通話イベントを取得する EventBridge ルールを作成
     * 通話イベントから ContactID と エージェント ARN を取得する
     */
    const contactRule = new events.Rule(this, 'ContactRule', {
      eventPattern: {
        source: ['aws.connect'],
        detailType: ['Amazon Connect Contact Event'],
        detail: {
          eventType: ['CONNECTED_TO_AGENT', 'INITIATED', 'DISCONNECTED'],
          channel: ['VOICE', 'TASK'],
          instanceArn: [connectInstanceArn],
        },
      },
    });
    contactRule.addTarget(new events_targets.LambdaFunction(connectEventProcessLambda));
  }
}
