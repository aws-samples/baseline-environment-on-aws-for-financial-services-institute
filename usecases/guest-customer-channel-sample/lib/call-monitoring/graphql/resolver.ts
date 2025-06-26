import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  QueryCommandInput,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/types';

/*
 * 通話イベント
 *
 * 各プロパティの説明
 * summary: 通話終了後に bedrock API により要約が作成され保存されます
 * cost: bedrock invokeModel 実行時に cost が計算され加算して保存されます
 * checkResult: 通話中に bedrock API により法令違反チェックが行われ結果が上書きで保存されます
 * startDate, endDate: リアルタイム音声分析セッションの開始と終了時刻を表し、通話開始・終了時刻とほぼ同じです
 */
type Contact = {
  PK: string;
  SK: string;
  contactId: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  summary?: string;
  checkResult?: string;
  cost?: number;
  type: string;
};

/*
 * エージェントの通話状況
 * startDate, endDate: 通話開始・終了時刻を表します
 */
type Assign = {
  PK: string;
  SK: string;
  contactId: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  agentId: string;
  agentName?: string;
  type: string;
};

/*
 * 文字起こしデータ
 */
type Transcript = {
  PK: string;
  SK: string;
  contactId: string;
  transcriptId: string;
  isPartial: boolean;
  participantRole: string;
  begin: number;
  end: number;
  transcript: string;
};

/*
 * 法令違反チェック Bot
 */
type Bot = {
  PK: string;
  SK: string;
  botId: string;
  botName: string;
  botDescription: string;
  botContents: string;
  active: boolean;
  type: string;
  createdAt: string;
  modifiedAt: string;
};

type EmptyArgument = Record<string, never>;

/*
 * Contact APIs
 */
type AddContactArgument = {
  //Add and Edit Contact
  input: {
    contactId: string;
    startDate?: string;
    endDate?: string;
    type: string;
  };
};

type GetContactArgument = {
  contactId: string;
};

type GetContactsArgument = {
  input?: {
    reverse?: boolean;
    limit?: number;
    lastKey?: string;
  };
};

type AddSummaryArgument = {
  input: {
    contactId: string;
    summary: string;
  };
};

/*
 * Assign APIs
 */
type AddAssignArgument = {
  input: {
    contactId: string;
    startDate?: string;
    endDate?: string;
    agentId: string;
    agentName?: string;
    type: string;
  };
};

type GetAssignsArgument = {
  input: {
    agentId: string;
    reverse?: boolean;
    limit?: number;
    lastKey?: string;
  };
};

/*
 * Transcript APIs
 */
type AddTranscriptArgument = {
  input: {
    contactId: string;
    transcriptId: string;
    isPartial: boolean;
    participantRole: string;
    begin: number;
    end: number;
    transcript: string;
  };
};

type GetTranscriptsArgument = {
  contactId: string;
};

type CheckTranscriptArgument = {
  input: {
    contactId: string;
  };
};

/*
 * Bot APIs
 */
type AddBotArgument = {
  input: {
    botId?: string;
    botName: string;
    botDescription: string;
    botContents: string;
    active: boolean;
  };
};

type DeleteBotArgument = {
  input: {
    botId: string;
  };
};

type DeleteBotResult = {
  botId: string;
};

type Result = Contact | Contact[] | Assign | Assign[] | Transcript | Transcript[] | Bot | Bot[] | DeleteBotResult;

type Argument =
  | AddContactArgument
  | GetContactArgument
  | AddSummaryArgument
  | AddAssignArgument
  | GetAssignsArgument
  | AddTranscriptArgument
  | GetTranscriptsArgument
  | CheckTranscriptArgument
  | AddBotArgument
  | DeleteBotArgument
  | EmptyArgument;

const dbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dbClient);
const lambdaClient = new LambdaClient();

const logger = new Logger({
  logLevel: (process.env.LOG_LEVEL ?? 'INFO') as LogLevel,
  serviceName: 'resolver',
});

export const handler: AppSyncResolverHandler<Argument, Result> = async (event, context) => {
  logger.debug(`${context.functionName} is called`, { event, context });
  logger.debug(`fieldName: ${event.info.fieldName}`);

  switch (event.info.fieldName) {
    case 'addContact':
      return await addContact(event.arguments as AddContactArgument);
    case 'getContact':
      return await getContact(event.arguments as GetContactArgument);
    case 'getContacts':
      return await getContacts(event.arguments as GetContactsArgument);
    case 'addAssign':
      return await addAssign(event.arguments as AddAssignArgument);
    case 'getAssigns':
      return await getAssigns(event.arguments as GetAssignsArgument);
    case 'addTranscript':
      return await addTranscript(event.arguments as AddTranscriptArgument);
    case 'getTranscripts':
      return await getTranscripts(event.arguments as GetTranscriptsArgument);
    case 'addSummary':
      return await addSummary(event.arguments as AddSummaryArgument);
    case 'checkTranscript':
      return await checkTranscript(event.arguments as CheckTranscriptArgument);
    case 'addBot':
      return await addBot(event.arguments as AddBotArgument);
    case 'deleteBot':
      return await deleteBot(event.arguments as DeleteBotArgument);
    case 'getBots':
      return await getBots();
    default:
      throw new Error('invalid event field!');
  }
};

const addContact = async (arg: AddContactArgument): Promise<Contact> => {
  logger.debug(`addContact is called`, { arg });
  const item = arg.input;

  if (item.endDate) {
    // update
    const command = new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: 'contact#' + item.contactId,
        SK: item.contactId,
      },
      UpdateExpression: `SET endDate = :endDate`,
      ExpressionAttributeValues: {
        ':endDate': item.endDate,
      },
      ReturnValues: 'ALL_NEW',
    });
    try {
      const result = await docClient.send(command);
      logger.debug('Completed: updateContact', { result });
      return result.Attributes as Contact;
    } catch (error) {
      throw new Error(`Failed to update contact: ${error}`);
    }
  } else {
    // newly add
    const newItem: Contact = {
      ...item,
      PK: 'contact#' + item.contactId,
      SK: item.contactId,
      createdAt: item.startDate ?? '',
    };
    const command = new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: newItem,
    });
    try {
      const result = await docClient.send(command);
      logger.debug('Completed: addContact', { result });
      return newItem as Contact;
    } catch (error) {
      throw new Error(`Failed to add contact: ${error}`);
    }
  }
};

const getContact = async (arg: GetContactArgument): Promise<Contact> => {
  logger.debug(`getContact is called`, { arg });
  const command = new GetCommand({
    TableName: process.env.TABLE_NAME!,
    Key: {
      PK: `contact#${arg.contactId}`,
      SK: arg.contactId,
    },
  });
  const response = await docClient.send(command);
  logger.debug('Completed: getContact');
  return response.Item as Contact;
};

const getContacts = async (arg: GetContactsArgument): Promise<Contact[]> => {
  logger.debug(`getContacts is called`, { arg });
  const item = arg.input;

  const limit = item?.limit ?? 10;
  const commandInput: QueryCommandInput = {
    TableName: process.env.TABLE_NAME!,
    IndexName: 'type_index',
    ExpressionAttributeNames: { '#type': 'type' },
    ExpressionAttributeValues: { ':val': `contact` },
    KeyConditionExpression: '#type = :val',
    ScanIndexForward: item?.reverse ? false : true, // 時系列にソート
    Limit: limit,
    // TODO: pagination with lastKey の実装 - assigns の戻り値に lastKey を含める必要あり
  };
  const responseItems = [];
  const command = new QueryCommand(commandInput);
  let response = await docClient.send(command);
  responseItems.push(...(response.Items ?? []));
  while (response.LastEvaluatedKey) {
    if (responseItems.length >= limit) {
      logger.debug('Limit reached.');
      break;
    }
    logger.debug('LastEvaluatedKey found.');
    commandInput.ExclusiveStartKey = response.LastEvaluatedKey;
    response = await docClient.send(new QueryCommand(commandInput));
    responseItems.push(...(response.Items ?? []));
    logger.debug('continue', { lastItem: responseItems[responseItems.length - 1] });
  }
  logger.debug('Completed: getContacts', { responseItems });
  return responseItems as Contact[];
};

const getAssigns = async (arg: GetAssignsArgument): Promise<Assign[]> => {
  logger.debug(`getAssigns is called`, { arg });
  const item = arg.input;

  if (!item.agentId) {
    logger.error('No agentId is provided.');
    throw new Error('No agentId is provided.');
  }
  const limit = item?.limit ?? 10;
  const commandInput: QueryCommandInput = {
    TableName: process.env.TABLE_NAME!,
    IndexName: 'type_index',
    ExpressionAttributeNames: { '#type': 'type', '#agentId': 'agentId' },
    ExpressionAttributeValues: { ':val': 'assign', ':val2': item.agentId },
    KeyConditionExpression: '#type = :val',
    FilterExpression: '#agentId = :val2',
    ScanIndexForward: item.reverse ? false : true, // 時系列にソート
    Limit: limit,
    // TODO: pagination with lastKey の実装 - assigns の戻り値に lastKey を含める必要あり
  };
  const responseItems = [];
  const command = new QueryCommand(commandInput);
  let response = await docClient.send(command);
  logger.debug('response', { response });
  responseItems.push(...(response.Items ?? []));
  while (response.LastEvaluatedKey) {
    if (responseItems.length >= limit) {
      logger.debug('Limit reached.');
      break;
    }
    logger.debug('LastEvaluatedKey found.');
    commandInput.ExclusiveStartKey = response.LastEvaluatedKey;
    response = await docClient.send(new QueryCommand(commandInput));
    responseItems.push(...(response.Items ?? []));
    logger.debug('continue', { lastItem: responseItems[responseItems.length - 1] });
  }
  logger.debug('Completed: getAssigns', { responseItems });
  return responseItems as Assign[];
};

const addAssign = async (arg: AddAssignArgument): Promise<Assign> => {
  logger.debug(`addAssign is called`, { arg });
  const item = arg.input;

  if (item.endDate) {
    // update
    const command = new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: 'assign#' + item.contactId,
        SK: item.agentId,
      },
      UpdateExpression: `SET endDate = :endDate`,
      ExpressionAttributeValues: {
        ':endDate': item.endDate,
      },
      ReturnValues: 'ALL_NEW',
    });
    try {
      const result = await docClient.send(command);
      logger.debug('Completed: updateAssign', { result });
      return result.Attributes as Assign;
    } catch (error) {
      throw new Error(`Failed to update assign: ${error}`);
    }
  } else {
    // newly add
    const newItem: Assign = {
      ...item,
      PK: 'assign#' + item.contactId,
      SK: item.agentId,
      createdAt: item.startDate ?? '',
    };
    const command = new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: newItem,
    });
    try {
      const result = await docClient.send(command);
      logger.debug('Completed: addAssign', { result });
      return newItem as Assign;
    } catch (error) {
      throw new Error(`Failed to add assign: ${error}`);
    }
  }
};

const addTranscript = async (arg: AddTranscriptArgument): Promise<Transcript> => {
  logger.debug(`addTranscript is called`, { arg });
  const item = arg.input;
  const newItem = { ...item, PK: 'transcript#' + item.contactId, SK: item.begin + '' }; // SK は 文字列
  const command = new PutCommand({
    TableName: process.env.TABLE_NAME,
    Item: newItem,
  });
  try {
    const result = await docClient.send(command);
    logger.debug('Completed: addTranscript', { result });
    return newItem as Transcript;
  } catch (error) {
    throw new Error(`Failed to add transcript: ${error}`);
  }
};

const getTranscripts = async (arg: GetTranscriptsArgument): Promise<Transcript[]> => {
  logger.debug(`getTranscripts is called`, { arg });
  const commandInput: QueryCommandInput = {
    TableName: process.env.TABLE_NAME!,
    IndexName: 'transcript_index',
    ExpressionAttributeNames: { '#pk': 'PK' },
    ExpressionAttributeValues: { ':val': `transcript#${arg.contactId}` },
    KeyConditionExpression: '#pk = :val',
    ScanIndexForward: true, // transcript を時系列にソート
  };

  const responseItems = [];

  const command = new QueryCommand(commandInput);
  let response = await docClient.send(command);
  responseItems.push(...(response.Items ?? []));
  while (response.LastEvaluatedKey) {
    logger.debug('LastEvaluatedKey found.');
    commandInput.ExclusiveStartKey = response.LastEvaluatedKey;
    response = await docClient.send(new QueryCommand(commandInput));
    responseItems.push(...(response.Items ?? []));
    logger.debug('continue', { lastItem: responseItems[responseItems.length - 1] });
  }
  logger.debug('Completed: getTranscripts', { responseItems });
  return responseItems as Transcript[];
};

const addSummary = async (arg: AddSummaryArgument): Promise<Contact> => {
  logger.debug(`addSummary is called`, { arg });
  const item = arg.input;
  // update
  const command = new UpdateCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: 'contact#' + item.contactId,
      SK: item.contactId,
    },
    UpdateExpression: `SET summary = :summary`,
    ExpressionAttributeValues: {
      ':summary': item.summary,
    },
    ReturnValues: 'ALL_NEW',
  });
  try {
    const result = await docClient.send(command);
    logger.debug('Completed: addSummary', { result });
    return result.Attributes as Contact;
  } catch (error) {
    throw new Error(`Failed to add summary: ${error}`);
  }
};

const checkTranscript = async (arg: CheckTranscriptArgument): Promise<Contact> => {
  logger.debug(`checkTranscript is called`, { arg });
  const item = arg.input;

  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: process.env.CHECK_TRANSCRIPT_FUNCTION_ARN,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        contactId: item.contactId,
      }),
    }),
  );
  const decodedPayload = new TextDecoder().decode(response.Payload);
  const payload = JSON.parse(decodedPayload);
  if (payload.errorType) {
    logger.error(`Failed to check transcript`, { errorMessage: payload.errorMessage });
    throw new Error(`Failed to check transcript: ${payload.errorMessage}`);
  } else {
    logger.debug('Completed: checkTranscript', { body: payload.body });
    return { ...payload.body } as Contact;
  }
};

const addBot = async (arg: AddBotArgument): Promise<Bot> => {
  logger.debug(`addBot is called`, { arg });
  const item = arg.input;
  const timestamp = new Date().toISOString();
  if (item.botId) {
    // update
    const command = new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `bot#${item.botId}`,
        SK: item.botId,
      },
      UpdateExpression: `SET botName = :botName, botDescription = :botDescription, botContents = :botContents, active = :active, modifiedAt = :modifiedAt`,
      ExpressionAttributeValues: {
        ':botName': item.botName,
        ':botDescription': item.botDescription,
        ':botContents': item.botContents,
        ':active': item.active,
        ':modifiedAt': timestamp,
      },
      ReturnValues: 'ALL_NEW',
    });
    const result = await docClient.send(command);
    logger.debug('Completed: editBot', { result });
    return result.Attributes as Bot;
  } else {
    // newly add
    const botId = uuidv4();
    const newBot: Bot = {
      ...item,
      PK: `bot#${botId}`,
      SK: botId,
      botId,
      type: 'bot',
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    const command = new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: newBot,
    });
    const result = await docClient.send(command);
    logger.debug('Completed: addBot', { result });
    return newBot as Bot;
  }
};

const getBots = async (): Promise<Bot[]> => {
  const commandInput: QueryCommandInput = {
    TableName: process.env.TABLE_NAME!,
    IndexName: 'type_index',
    ExpressionAttributeNames: { '#type': 'type' },
    ExpressionAttributeValues: { ':val': `bot` },
    KeyConditionExpression: '#type = :val',
    ScanIndexForward: true, // 時系列にソート
  };

  const responseItems = [];

  const command = new QueryCommand(commandInput);
  let response = await docClient.send(command);
  responseItems.push(...(response.Items ?? []));
  while (response.LastEvaluatedKey) {
    logger.debug('LastEvaluatedKey found.');
    commandInput.ExclusiveStartKey = response.LastEvaluatedKey;
    response = await docClient.send(new QueryCommand(commandInput));
    responseItems.push(...(response.Items ?? []));
    logger.debug('continue', { lastItem: responseItems[responseItems.length - 1] });
  }
  logger.debug('Completed: getBots', { responseItems });
  return responseItems as Bot[];
};

const deleteBot = async (arg: DeleteBotArgument): Promise<DeleteBotResult> => {
  logger.debug(`deleteBot is called`, { arg });
  const item = arg.input;
  const command = new DeleteCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      PK: `bot#${item.botId}`,
      SK: item.botId,
    },
  });
  const result = await docClient.send(command);
  logger.debug(`botResult:`, { result });
  return { ...item } as DeleteBotResult;
};
