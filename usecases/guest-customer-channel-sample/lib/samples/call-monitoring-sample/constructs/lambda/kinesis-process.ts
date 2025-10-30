import { Context } from 'aws-lambda';
import { fromEnv } from '@aws-sdk/credential-providers';
// import '@apollo/client' cause react dependency error, use core instead
import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, DocumentNode } from '@apollo/client/core';
import { AUTH_TYPE, AuthOptions, createAuthLink } from 'aws-appsync-auth-link';
import { gql } from 'graphql-tag';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/types';

const logger = new Logger({
  logLevel: (process.env.LOG_LEVEL ?? 'INFO') as LogLevel,
  serviceName: 'kinesis-process',
});

type Segment = {
  contactId: string;
  transcriptId: string;
  isPartial: boolean;
  participantRole: string;
  begin: number;
  end: number;
  transcript: string;
};

type Contact = {
  contactId: string;
  startDate?: string;
  endDate?: string;
  type: string;
};

type Assign = {
  contactId: string;
  startDate?: string;
  endDate?: string;
  agentId: string;
  agentName?: string;
  type: string;
};

// GraphQL クエリ
const Query = {
  TRANSCRIPT: gql`
    mutation addTranscript($input: AddTranscriptInput!) {
      addTranscript(input: $input) {
        PK
        SK
        contactId
        transcriptId
        isPartial
        participantRole
        begin
        end
        transcript
      }
    }
  `,
  CONTACT: gql`
    mutation addContact($input: AddContactInput!) {
      addContact(input: $input) {
        PK
        SK
        contactId
        startDate
        endDate
        summary
        type
      }
    }
  `,
  ASSIGN: gql`
    mutation addAssign($input: AddAssignInput!) {
      addAssign(input: $input) {
        PK
        SK
        contactId
        startDate
        endDate
        agentId
        agentName
        type
      }
    }
  `,
};

const lambdaClient = new LambdaClient();

/**
 * Kinesis Stream から Invoke される Lambda 関数
 * 各イベントを取得し、GraphQL API (AppSync) にデータを送信します
 */
export const handler = async (event: any, context: Context) => {
  logger.debug(`${context.functionName} is called`, { event, context });

  const completedContactIds = [];
  const mutateRecords: { queryType: 'TRANSCRIPT' | 'CONTACT' | 'ASSIGN'; input: Segment | Contact | Assign }[] = [];
  for (const record of event.Records) {
    const message = Buffer.from(record.kinesis.data, 'base64').toString();
    const decoded = JSON.parse(message);
    logger.debug('decoded', { decoded });

    if (decoded.Channel == 'VOICE' && decoded.EventType == 'SEGMENTS') {
      for (const segment of decoded.Segments) {
        if ('Categories' in segment) {
          continue;
        }
        const s = transformSegment(decoded.ContactId, segment);
        mutateRecords.push({ queryType: 'TRANSCRIPT', input: s });
      }
    } else if (decoded.Channel == 'VOICE' && decoded.EventType == 'STARTED') {
      const s: Contact = {
        contactId: decoded.ContactId,
        startDate: new Date().toISOString(),
        type: 'contact',
      };
      mutateRecords.push({ queryType: 'CONTACT', input: s });
    } else if (decoded.Channel == 'VOICE' && decoded.EventType == 'COMPLETED') {
      completedContactIds.push(decoded.ContactId);
      const s: Contact = {
        contactId: decoded.ContactId,
        endDate: new Date().toISOString(),
        type: 'contact',
      };
      mutateRecords.push({ queryType: 'CONTACT', input: s });
    } else if (decoded.Channel == 'VOICE' && decoded.EventType == 'UPDATE_AGENT') {
      const s: Assign = {
        contactId: decoded.ContactId,
        agentId: decoded.AgentId,
        startDate: decoded.StartDate,
        type: 'assign',
      };
      // AgentName は CONNECTED イベントでのみ設定される
      // EndDate は DISCONNECTED イベントでのみ設定される
      if (decoded.EndDate) {
        s.endDate = decoded.EndDate;
      }
      if (decoded.AgentName) {
        s.agentName = decoded.AgentName;
      }
      mutateRecords.push({ queryType: 'ASSIGN', input: s });
    } else if (decoded.EventType == 'TRANSFER_OR_MONITOR') {
      // 転送、モニタリング時、元のコンタクトに対して要約生成を行います
      const orgContactId = decoded.OrgContactId;
      logger.debug('invoke', { contactId: orgContactId, functionArn: process.env.SUMMARY_FUNCTION_ARN });
      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: process.env.SUMMARY_FUNCTION_ARN,
          InvocationType: 'Event',
          Payload: JSON.stringify({
            contactId: orgContactId,
          }),
        }),
      );
    }
  }

  logger.debug('mutateRecords', { mutateRecords });

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

  for (const record of mutateRecords) {
    try {
      await client.mutate({
        mutation: Query[record.queryType],
        variables: {
          input: record.input,
        },
      });
    } catch (error) {
      logger.error('Failed to mutate record', { record, error });
    }
  }

  // 通話終了時に Bedrock による要約を開始
  logger.debug('completedContactIds', { completedContactIds });
  for (const contactId of completedContactIds) {
    // 非同期処理で Bedrock による要約を開始
    logger.debug('invoke', { contactId, functionArn: process.env.SUMMARY_FUNCTION_ARN });
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: process.env.SUMMARY_FUNCTION_ARN,
        InvocationType: 'Event',
        Payload: JSON.stringify({
          contactId,
        }),
      }),
    );
  }

  return;
};

/**
 * Kinesis Stream から取得されるセグメントデータ例
 * Utterance は部分的なデータ、Transcript は完全なデータを表します 
{
  "Utterance": {
      "ParticipantId": "AGENT",
      "ParticipantRole": "AGENT",
      "BeginOffsetMillis": 58587,
      "EndOffsetMillis": 62897,
      "Id": "2b71a8f8-4a73-494e-9017-bc4c8d9f4ffe",
      "TranscriptId": "4bca32b9-71e1-4cc1-8311-61b6a6863efa",
      "PartialContent": "そのまま少しお待ちください。五分以内にお電話折り返しいたします。"
  }
}
{
  "Transcript": {
      "ParticipantId": "AGENT",
      "ParticipantRole": "AGENT",
      "Content": "ありがとうございます。では、そのまま少しお待ちください。五分以内にお電話折り返しいたします。",
      "BeginOffsetMillis": 56947,
      "EndOffsetMillis": 62897,
      "Id": "4bca32b9-71e1-4cc1-8311-61b6a6863efa",
      "Sentiment": "POSITIVE",
      "IssuesDetected": []
  }
}
 */

function transformSegment(contactId: string, segment: any): Segment {
  let data;
  let transcriptId;
  let isPartial;
  let transcript;
  if ('Utterance' in segment) {
    data = segment.Utterance;
    transcriptId = data.TranscriptId;
    isPartial = true;
    transcript = data.PartialContent;
  } else if ('Transcript' in segment) {
    data = segment.Transcript;
    transcriptId = data.Id;
    isPartial = false;
    transcript = data.Content;
  }
  return {
    contactId,
    transcriptId,
    isPartial,
    participantRole: data.ParticipantRole,
    begin: data.BeginOffsetMillis,
    end: data.EndOffsetMillis,
    transcript,
  } as Segment;
}
