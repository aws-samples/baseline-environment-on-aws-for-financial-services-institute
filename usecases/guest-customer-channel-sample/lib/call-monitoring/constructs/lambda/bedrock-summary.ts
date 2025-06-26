import { Context } from 'aws-lambda';
import { fromEnv } from '@aws-sdk/credential-providers';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
// import '@apollo/client' cause react dependency error, use core instead
import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client/core';
import { AUTH_TYPE, AuthOptions, createAuthLink } from 'aws-appsync-auth-link';
import { gql } from 'graphql-tag';
import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/types';

const logger = new Logger({
  logLevel: (process.env.LOG_LEVEL ?? 'INFO') as LogLevel,
  serviceName: 'bedrock-summary',
});

/**
 * DynamoDB クライアントを作成する
 */
const dbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dbClient);

// GraphQL クエリ - contact 用
const contactQuery = gql`
  mutation addSummary($input: AddSummaryInput!) {
    addSummary(input: $input) {
      PK
      SK
      contactId
      summary
    }
  }
`;

// 本プロトタイプでは Claude3 Sonnet を使用して文字起こしの要約を生成します
// Claude3 は 2024/6/24 現在 us-east-1 や us-west-2 リージョンで利用可能です。
// 利用するには us-east-1 リージョンで Claude3 モデルに対しアクセスリクエストを行ってください。
const bedrockClient = new BedrockRuntimeClient({
  region: 'us-east-1',
});

// その他の Claude モデルに変更する場合は modelId を変更してください
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html#model-ids-arns
// const BEDROCK_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0'; // 最速モデル、日常的なタスクに最適化
const BEDROCK_MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0'; // claude3 sonnet - 速度と能力のバランスが取れたモデル
// const BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20240620-v1:0'; // claude3.5 sonnet - 最も知的なモデル、複雑なタスクに最適

// 出力に関するパラメーター
// 低い値にするほど決定的・再現性のある出力になり、高い値にするほど多様な出力になります
// https://docs.anthropic.com/claude/reference/complete_post
const CLAUDE_BASE_PARAMS = {
  anthropic_version: 'bedrock-2023-05-31',
  max_tokens: 4096, // モデルが生成する最大のトークン数
  temperature: 0.5, // 0~1の間で指定。出力する文章の自由度。
  top_p: 0.8, // 0~1の間で指定。各後続のトークンについて、すべてのオプションの確率分布を降順に計算し、指定されたtop_pの確率に達した時点で打ち切ります。
  top_k: 300, // 0~500の間で指定。モデルが考慮する選択肢の候補数。後続の各トークンの上位 K 個のオプションからのみサンプリングします。
};

/**
 * Bedrock invokeModel を実行する Lambda 関数
 * 文字起こしデータを取得し、要約を生成します
 */
export const handler = async (event: any, context: Context) => {
  logger.debug(`${context.functionName} is called`, { event, context });

  const contactId = event.contactId;
  if (!contactId) {
    logger.debug('No contactId. Skip processing.');
    return;
  }

  // DynamoDB から文字起こしデータを取得します
  const querResponse = await docClient.send(
    new QueryCommand({
      TableName: process.env.TABLE_NAME!,
      IndexName: 'transcript_index',
      ExpressionAttributeNames: { '#pk': 'PK' },
      ExpressionAttributeValues: { ':val': `transcript#${contactId}` },
      KeyConditionExpression: '#pk = :val',
      ScanIndexForward: true, // transcript を時系列にソート
    }),
  );
  logger.debug('Query response:', { querResponse });

  const items = querResponse.Items;
  if (!items || items.length === 0) {
    logger.debug('No items found. Skip processing.');
    return;
  }

  let transcript = items.filter((item) => item.isPartial === false);
  transcript = transcript.map((item) => {
    return {
      participantRole: item.participantRole,
      transcript: item.transcript,
    };
  });

  // 文字起こしデータを Bedrock - Claude で要約します
  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    body: JSON.stringify({
      ...CLAUDE_BASE_PARAMS,
      messages: [
        {
          role: 'user',
          content: getPrompt(JSON.stringify(transcript)),
        },
      ],
    }),
    contentType: 'application/json',
  });
  const bedrockOutput = await bedrockClient.send(command);
  const decodedResponseBody = new TextDecoder().decode(bedrockOutput.body);
  const responseBody = JSON.parse(decodedResponseBody);
  const summary = responseBody.content[0].text;
  logger.debug('summary', { summary });

  // GraphQL クライアントを作成します
  const config = {
    url: process.env.GRAPHQL_URL!,
    region: process.env.AWS_REGION!,
    auth: {
      type: AUTH_TYPE.AWS_IAM,
      credentials: fromEnv(),
    } satisfies AuthOptions,
  };
  const link = ApolloLink.from([createAuthLink(config), new HttpLink({ uri: process.env.GRAPHQL_URL })]);

  const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });

  // Appsync に要約が終了したことを通知します
  const input = {
    contactId: contactId,
    summary,
  };
  await client.mutate({
    mutation: contactQuery,
    variables: {
      input,
    },
  });
  return;
};

const PROMPT = `あなたは優れた会話要約能力を持つAIアシスタントです。コンタクトセンターでの会話記録が与えられたら、以下の項目で要約してください。
1. 問い合わせの種類(新規契約、契約変更、料金問い合わせ、トラブルなど)
2. 顧客の主な質問や要望内容
3. オペレータの主な回答と提案した解決策や対応手順
4. 手続きや問題解決の進捗状況(完了、追加対応が必要など)
5. 顧客の反応(満足度)
6. 付加情報(重要な契約内容、特記事項など)
会話記録は<transcript></transcript>に発言内容が配列形式で時系列に記録されています。
配列中の各要素は JSON で、中身の "transcript" は会話の発言内容を示しています。"participantRole" は、発言者の属性です。
participantRole が同じ場合、同一話者の発言です。AGENT はオペレータ、CUSTOMER は顧客を示します。
要約は簡潔かつ明確で、冗長な部分は避けてコンパクトにまとめてください。感情的な表現は控えめにし、客観的で公平な内容にしてください。個人的な意見や解釈は加えないでください。
話し言葉がそのまま記録されているため、フィラーワードを含んでいたり、文法的に間違っている場合もありますが、そこは重要ではありません。発言者の意図を理解してください。
`;

const getPrompt = (transcript: string) => {
  return `${PROMPT}
<transcript>
${transcript}
</transcript>`;
};
