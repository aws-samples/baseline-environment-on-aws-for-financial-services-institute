import { Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/types';

type Bot = {
  botId: string;
  botName: string;
  botDescription?: string;
  botContents: string;
};

const logger = new Logger({
  logLevel: (process.env.LOG_LEVEL ?? 'INFO') as LogLevel,
  serviceName: 'bedrock-check-transcript',
});

const dbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dbClient);

// 本プロトタイプでは Claude3 Sonnet を使用して会話内容のチェックを行います
// Claude3 は 2024/6/24 現在 us-east-1 や us-west-2 リージョンで利用可能です。
// 利用するには us-east-1 リージョンで Claude3 モデルに対しアクセスリクエストを行ってください。
const BEDROCK_REGION = 'us-east-1';
const bedrockClient = new BedrockRuntimeClient({
  region: BEDROCK_REGION,
});

// その他の Claude モデルに変更する場合は modelId を変更してください
// https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html#model-ids-arns
// const BEDROCK_MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0'; // 最速モデル、日常的なタスクに最適化
const BEDROCK_MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0'; // claude3 sonnet - 速度と能力のバランスが取れたモデル
// const BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20240620-v1:0'; // claude3.5 sonnet - 最も知的なモデル、複雑なタスクに最適

/*
 * Bedrock の料金情報
 * The following is based on 2024-06-24
 * @see https://aws.amazon.com/bedrock/pricing/
 */
const BEDROCK_PRICING = {
  'us-east-1': {
    //1,000 input/output tokens
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  },
};

// 出力に関するパラメーター
// 低い値にするほど決定的・再現性のある出力になり、高い値にするほど多様な出力になります
// https://docs.anthropic.com/claude/reference/complete_post
const CLAUDE_BASE_PARAMS = {
  anthropic_version: 'bedrock-2023-05-31',
  max_tokens: 2048, // モデルが生成する最大のトークン数
  temperature: 0.0, // 0~1の間で指定。出力する文章の自由度。
  top_p: 0.8, // 0~1の間で指定。各後続のトークンについて、すべてのオプションの確率分布を降順に計算し、指定されたtop_pの確率に達した時点で打ち切ります。
  top_k: 250, // 0~500の間で指定。モデルが考慮する選択肢の候補数。後続の各トークンの上位 K 個のオプションからのみサンプリングします。
};

/**
 * Bedrock invokeModel を実行する Lambda 関数
 * 文字起こしデータのコンプライアンスチェックを行います
 */
export const handler = async (event: any, context: Context) => {
  logger.debug(`${context.functionName} is called`, { event, context });

  const contactId = event.contactId;
  if (!contactId) {
    logger.error('No contactId. Skip processing.');
    throw new Error('No contactId.');
  }

  // DynamoDB から文字起こしデータを取得します
  // 文字起こしデータがない場合は No transcripts. という文字列を返します
  let transcript = [];
  try {
    const queryResponse = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME!,
        IndexName: 'transcript_index',
        ExpressionAttributeNames: { '#pk': 'PK' },
        ExpressionAttributeValues: { ':val': `transcript#${contactId}` },
        KeyConditionExpression: '#pk = :val',
        ScanIndexForward: true, // transcript を時系列にソート
      }),
    );
    logger.debug('Query response for Transcripts:', { queryResponse });
    const items = queryResponse.Items;
    if (!items || items.length === 0) {
      logger.debug('No transcripts found. Skip processing.');
      // 後続処理はスキップし、正常なレスポンスを返します
      return { body: 'No transcripts.' };
    }
    transcript = items.filter((item) => item.isPartial === false);
    transcript = transcript.map((item) => {
      return {
        participantRole: item.participantRole,
        transcript: item.transcript,
      };
    });
  } catch (error) {
    logger.error('Failed to get transcripts.', { error });
    throw new Error('Failed to get transcripts.');
  }

  // Active bot を取得します
  // Active bot が存在しない場合はデフォルトのプロンプトを使用します
  let bot = null;
  try {
    const botQueryResponse = await docClient.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME!,
        IndexName: 'type_index',
        ExpressionAttributeNames: { '#type': 'type', '#active': 'active' },
        ExpressionAttributeValues: { ':val': `bot`, ':val2': true },
        KeyConditionExpression: '#type = :val',
        FilterExpression: '#active = :val2',
        ScanIndexForward: true, // 時系列にソート
      }),
    );
    logger.debug('Query response for Bots:', { botQueryResponse });
    bot = botQueryResponse.Items ? (botQueryResponse.Items[0] as Bot) : null;
  } catch (error) {
    // Bot 取得でエラーになる場合はデフォルトのプロンプトで処理を続行するため、エラーは送信せず処理を継続します
    logger.error('Failed to get active bot.', { error });
  }
  logger.debug('bot:', { bot });

  // 文字起こしデータを Bedrock に送信してコンプライアンスチェックを実施します
  let text = '';
  let usage = null;
  let updatedContact = null;
  try {
    const prompt = getPrompt(JSON.stringify(transcript), bot?.botContents);
    logger.debug('Prompt:', { prompt });

    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      body: JSON.stringify({
        ...CLAUDE_BASE_PARAMS,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
      }),
      contentType: 'application/json',
    });
    const bedrockOutput = await bedrockClient.send(command);
    const decodedResponseBody = new TextDecoder().decode(bedrockOutput.body);
    const responseBody = JSON.parse(decodedResponseBody);
    text = responseBody.content[0].text;
    // answer タグの中身を取得 改行を含むため . ではなく [\s\S] を使用
    const answer = text.match(/<answer>([\s\S]*)<\/answer>/);
    if (answer) {
      text = answer[1];
    }
    usage = responseBody.usage;
  } catch (error) {
    logger.error('Failed to execute check.', { error });
    throw new Error('Failed to execute check.');
  }

  // 結果とコストを DynamoDB に保存します
  try {
    const cost = calculateCost({ ...usage });
    const result = await docClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: `contact#${contactId}`,
          SK: contactId,
        },
        UpdateExpression: `SET cost = if_not_exists(cost, :zero) + :cost, checkResult = :checkResult`,
        ExpressionAttributeValues: {
          ':zero': 0,
          ':cost': cost,
          ':checkResult': text,
        },
        ReturnValues: 'ALL_NEW',
      }),
    );
    logger.debug('Completed: updateContact', { result });
    updatedContact = result;
  } catch (error) {
    logger.error('Failed to save check result.', { error });
    // 保存処理でエラーが発生しても処理を続行します
  }
  if (!updatedContact) {
    // fallback to return only checkResult
    updatedContact = { contactId, checkResult: text };
  }
  return { body: updatedContact?.Attributes };
};

/*
 * デフォルトのプロンプトを生成します
 */
const CONTEXT = {
  format: `- 回答は配列形式で記述してください。（例: [{ "label": "顧客の名前を確認", "confirmed": false, "importance": "high", "source": "" }]）
  - 配列の他には何も回答に含めないで返してください。
  - 回答の配列には、個々の質問内容に対する回答を JSON オブジェクト形式として追加してください。
  - 配列中の JSON オブジェクトの順序は確認事項の番号順に並べてください。
  - 個々の質問内容に対する回答となる JSON の要素に "label" と "confirmed", "importance", "source" という子要素を追加してください。
  - label には確認の内容を簡潔に書いてください。日本語で30文字以内に収めてください。
  - confirmed には結果を true か false を入力してください。
  - 必須事項と推奨事項では、説明・確認した場合は true、していない場合は false と入力してください。チェックが未実施の場合は false としてください。
  - 違反事項では、違反している場合は true、違反していない場合は false と入力してください。チェックが未実施の場合は false としてください。
  - importance には違反事項の場合は "alert"、必須事項の場合は "high"、推奨事項の場合は "low" と入力してください。
  - source には true の場合の根拠となるオペレータの発言を記述してください。source の値は単一の文字列である必要があります。発言が複数ある場合は、連結した1つの文字列にしてください。その際、連結したことを示す文字として'/'を発言と発言の間に挿入してください。`,
  rules: `- 発言内容を全て理解してください。
  - オペレータの発言を元に、それぞれのチェック項目の内容を行なったかどうかを判断してください。
  - オペレータの発言だけで判断が難しい場合は、顧客の発言も参考にしてください。
  - 該当する発言の例は項目の（）内に記載されています。ただし（）の例は一部であり、完全に合致する必要はありません。
  - 判断のための会話履歴が不足している場合、チェックは実施しないでください。
  - 不適切な発言や言葉遣いについてもチェック対象であるため、そのままの発言内容に対してチェックを実施してください。
  - 言い間違えや書き起こしミスにより、発言内容が異なる言葉になっている可能性がありますが、会話の文脈やその言葉の音の響きから判断してください。
  - 話し言葉がそのまま記録されているため、フィラーワードを含んでいたり、文法的に間違っている場合もありますが、そこは重要ではありません。発言者の意図を理解してください。`,
};

// 一般確認事項2種類、必須確認事項1種、違反1種類
const DEFAULT_CHECKS = `
1. 顧客の名前を確認したか。（例: お名前を頂戴できますか。お名前をお聞かせいただけますか。）
2. 顧客の電話番号を確認したか。（例: 電話番号を頂戴できますか。電話番号をお聞かせいただけますか。）
3. 契約するプランを伝えたか。（例: ライト、スタンダード、プレミアム）
4. お客さまが「いりません」「興味ありません」「お断りします」「結構です」などと断っているのに勧誘を続けた。
1〜2の事項は推奨事項であり、3の事項は会話中に必ず行う必要がある必須事項であり、4の事項は行ったら違反となる違反事項です。`;

const PROMPT = `あなたはコンタクトセンターでの会話内容をチェックする担当者です。オペレータの発言を元に下記のチェックリストの各項目を判断するのが仕事です。
<checks></checks> に判断すべきチェック項目が書かれています。
<transcript></transcript> に発言内容が配列形式で時系列に記録されています。
配列中の各要素は JSON で、中身の "transcript" は会話の発言内容を示しています。 "participantRole" は発言者の属性です。participantRole が同じ場合、同一話者の発言です。AGENT はオペレータ、CUSTOMER は顧客を示します。
<rules></rules> に沿って、<format></format> の通りに回答し、<answer></answer>タグ内に回答を記述してください。
<rules>
${CONTEXT.rules}
</rules>
<format>
${CONTEXT.format}
</format>`;

const getPrompt = (transcript: string, checks?: string) => {
  return `${PROMPT}
  <checks>${checks ?? DEFAULT_CHECKS}</checks>
<transcript>
${transcript}
</transcript>`;
};

const calculateCost = (usage: { input_tokens: number; output_tokens: number }) => {
  const prices = BEDROCK_PRICING[BEDROCK_REGION]['claude-3-sonnet'];
  const inputCost = prices['input'] * usage['input_tokens'] * (1 / 1000);
  const outputCost = prices['output'] * usage['output_tokens'] * (1 / 1000);
  return inputCost + outputCost;
};
