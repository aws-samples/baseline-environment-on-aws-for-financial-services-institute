import { Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ConnectClient, DescribeUserCommand } from '@aws-sdk/client-connect';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';
import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/types';

const logger = new Logger({
  logLevel: (process.env.LOG_LEVEL ?? 'INFO') as LogLevel,
  serviceName: 'connect-event-process',
});

const connectClient = new ConnectClient();
const kinesisClient = new KinesisClient();
const dbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dbClient);

const timeout = process.env.TIMEOUT ? parseInt(process.env.TIMEOUT) : 30000;

/**
 * EventBridge から Invoke される Lambda 関数
 * エージェントイベント（CONNECTED_TO_AGENT）を取得し、Kinisis Stream にデータを送信します
 * その他の Amazon Connect の contact イベントの種類は下記のリンクを参考にしてください
 * https://docs.aws.amazon.com/ja_jp/connect/latest/adminguide/contact-events.html
 *
 * TODO: Connect API のスロットリング懸念があるため、Connect エージェントデータのキャッシュ利用を検討してください
 */
export const handler = async (event: any, context: Context) => {
  logger.debug(`${context.functionName} is called`, { event, context });

  const detail = event.detail;
  const contactId = detail.contactId;

  if (detail.eventType === 'INITIATED') {
    // 転送またはモニタリング時、元のコンタクトの summary 生成を行うためのイベントを KDS に送信します
    // channel が VOICE と TASK の場合で、元のコンタクト ID の取得先は異なります
    let orgContactId = '';
    if (detail.channel === 'VOICE') {
      orgContactId = detail.initialContactId;
    } else if (detail.channel === 'TASK') {
      orgContactId = detail.relatedContactId;
    }
    logger.debug(`${detail.initiationMethod} for ${detail.channel} is executed.`, { contactId, orgContactId });
    if (orgContactId) {
      if (await isKnownContactId(orgContactId)) {
        logger.debug(`${contactId} is found in table`);
        const message = {
          Channel: detail.channel,
          ContactId: detail.contactId,
          OrgContactId: orgContactId,
          EventType: 'TRANSFER_OR_MONITOR',
        };
        await kinesisClient.send(
          new PutRecordCommand({
            StreamName: process.env.STREAM_NAME!,
            Data: Buffer.from(JSON.stringify(message)),
            PartitionKey: orgContactId,
          }),
        );
      }
    }
  } else if (detail.eventType === 'CONNECTED_TO_AGENT') {
    // エージェント情報を取得し、KDS に送信します
    if (await isKnownContactId(contactId)) {
      logger.debug(`${contactId} is found in table`);

      try {
        const agentInfo = await connectClient.send(
          new DescribeUserCommand({
            InstanceId: detail.instanceArn,
            UserId: detail.agentInfo.agentArn,
          }),
        );
        logger.debug('agentInfo found', { agentInfo });

        if (agentInfo.User) {
          const message = {
            Channel: detail.channel,
            ContactId: detail.contactId,
            StartDate: detail.agentInfo.connectedToAgentTimestamp,
            AgentId: agentInfo.User.Id ?? '',
            AgentName: agentInfo.User.Username ?? '',
            EventType: 'UPDATE_AGENT',
          };

          await kinesisClient.send(
            new PutRecordCommand({
              StreamName: process.env.STREAM_NAME!,
              Data: Buffer.from(JSON.stringify(message)),
              PartitionKey: detail.contactId,
            }),
          );
        }
      } catch (err) {
        logger.error('Error connect:DescribeUser', err as Error);
      }
    }
  } else if (detail.eventType === 'DISCONNECTED') {
    // 通話終了時、エージェント情報に対する EndDate を KDS に送信します
    const arn = detail.agentInfo.agentArn;
    const arnParts = arn.split('/') ?? [];
    let agentId = '';
    if (arnParts.length > 0) {
      agentId = arnParts[arnParts.length - 1];
    }
    if (agentId) {
      if (await isKnownAssign(contactId, agentId)) {
        logger.debug(`${contactId} is found in table`);

        const message = {
          Channel: detail.channel,
          ContactId: detail.contactId,
          StartDate: detail.agentInfo.connectedToAgentTimestamp,
          EndDate: detail.disconnectTimestamp,
          AgentId: agentId,
          EventType: 'UPDATE_AGENT',
        };
        await kinesisClient.send(
          new PutRecordCommand({
            StreamName: process.env.STREAM_NAME!,
            Data: Buffer.from(JSON.stringify(message)),
            PartitionKey: detail.contactId,
          }),
        );
      }
    }
  } else {
    logger.debug('Unknown event type. Skip processing.');
  }

  return;
};

/**
 * DynamoDB に ContactId のデータがあるかチェックします
 * 取得時はデータがない場合があるため、timeout を設けて1秒おきにリトライします
 */
async function isKnownContactId(contactId: string): Promise<boolean> {
  const timeoutTime = Date.now() + timeout * 1000;
  while (Date.now() < timeoutTime) {
    try {
      const response = await docClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME!,
          Key: {
            PK: `contact#${contactId}`,
            SK: contactId,
          },
        }),
      );
      if (response.Item) {
        logger.debug('Found contact:', { item: response.Item });
        return true;
      }
    } catch (err) {
      logger.error('Error checking table', err as Error);
    }
    logger.info(`ContactId not found in table - wait 1 sec and try again: ${contactId}`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 sec wait
  }
  return false;
}

/**
 * DynamoDB に Assign のデータがあるかチェックします
 */
async function isKnownAssign(contactId: string, agentId: string): Promise<boolean> {
  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME!,
        Key: {
          PK: `assign#${contactId}`,
          SK: agentId,
        },
      }),
    );
    if (response.Item) {
      logger.debug('Found contact:', { item: response.Item });
      return true;
    }
  } catch (err) {
    logger.error('Error checking table', err as Error);
  }
  return false;
}
