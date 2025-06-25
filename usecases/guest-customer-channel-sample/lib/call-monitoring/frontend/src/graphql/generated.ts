import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type AddAssignInput = {
  agentId: Scalars['ID']['input'];
  agentName?: InputMaybe<Scalars['String']['input']>;
  contactId: Scalars['ID']['input'];
  endDate?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};

export type AddBotInput = {
  active: Scalars['Boolean']['input'];
  botContents: Scalars['String']['input'];
  botDescription?: InputMaybe<Scalars['String']['input']>;
  botId?: InputMaybe<Scalars['ID']['input']>;
  botName: Scalars['String']['input'];
};

export type AddContactInput = {
  contactId: Scalars['ID']['input'];
  endDate?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};

export type AddSummaryInput = {
  contactId: Scalars['ID']['input'];
  summary: Scalars['String']['input'];
};

export type AddTranscriptInput = {
  begin: Scalars['Int']['input'];
  contactId: Scalars['ID']['input'];
  end: Scalars['Int']['input'];
  isPartial: Scalars['Boolean']['input'];
  participantRole: Scalars['String']['input'];
  transcript: Scalars['String']['input'];
  transcriptId: Scalars['ID']['input'];
};

export type Assign = {
  __typename?: 'Assign';
  PK: Scalars['ID']['output'];
  SK: Scalars['String']['output'];
  agentId: Scalars['ID']['output'];
  agentName?: Maybe<Scalars['String']['output']>;
  contactId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  endDate?: Maybe<Scalars['String']['output']>;
  startDate: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type Bot = {
  __typename?: 'Bot';
  PK: Scalars['ID']['output'];
  SK: Scalars['String']['output'];
  active: Scalars['Boolean']['output'];
  botContents: Scalars['String']['output'];
  botDescription?: Maybe<Scalars['String']['output']>;
  botId: Scalars['ID']['output'];
  botName: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  modifiedAt: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type CheckTranscriptInput = {
  contactId: Scalars['ID']['input'];
};

export type Contact = {
  __typename?: 'Contact';
  PK: Scalars['ID']['output'];
  SK: Scalars['String']['output'];
  checkResult?: Maybe<Scalars['String']['output']>;
  contactId: Scalars['ID']['output'];
  cost?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['String']['output'];
  endDate?: Maybe<Scalars['String']['output']>;
  startDate?: Maybe<Scalars['String']['output']>;
  summary?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
};

export type DeleteBotInput = {
  botId: Scalars['ID']['input'];
};

export type DeleteBotResult = {
  __typename?: 'DeleteBotResult';
  botId: Scalars['ID']['output'];
};

export type GetAssignsInput = {
  agentId: Scalars['ID']['input'];
  lastKey?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  reverse?: InputMaybe<Scalars['Boolean']['input']>;
};

export type GetContactsInput = {
  lastKey?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  reverse?: InputMaybe<Scalars['Boolean']['input']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addAssign?: Maybe<Assign>;
  addBot?: Maybe<Bot>;
  addContact?: Maybe<Contact>;
  addSummary?: Maybe<Contact>;
  addTranscript?: Maybe<Transcript>;
  checkTranscript?: Maybe<Contact>;
  deleteBot?: Maybe<DeleteBotResult>;
};

export type MutationAddAssignArgs = {
  input: AddAssignInput;
};

export type MutationAddBotArgs = {
  input: AddBotInput;
};

export type MutationAddContactArgs = {
  input: AddContactInput;
};

export type MutationAddSummaryArgs = {
  input: AddSummaryInput;
};

export type MutationAddTranscriptArgs = {
  input: AddTranscriptInput;
};

export type MutationCheckTranscriptArgs = {
  input: CheckTranscriptInput;
};

export type MutationDeleteBotArgs = {
  input: DeleteBotInput;
};

export type Query = {
  __typename?: 'Query';
  getAssigns?: Maybe<Array<Maybe<Assign>>>;
  getBots?: Maybe<Array<Maybe<Bot>>>;
  getContact?: Maybe<Contact>;
  getContacts?: Maybe<Array<Maybe<Contact>>>;
  getTranscripts?: Maybe<Array<Maybe<Transcript>>>;
};

export type QueryGetAssignsArgs = {
  input: GetAssignsInput;
};

export type QueryGetContactArgs = {
  contactId: Scalars['ID']['input'];
};

export type QueryGetContactsArgs = {
  input?: InputMaybe<GetContactsInput>;
};

export type QueryGetTranscriptsArgs = {
  contactId: Scalars['ID']['input'];
};

export type Subscription = {
  __typename?: 'Subscription';
  onAddAssign?: Maybe<Assign>;
  onAddContact?: Maybe<Contact>;
  onAddSummary?: Maybe<Contact>;
  onAddTranscript?: Maybe<Transcript>;
};

export type SubscriptionOnAddAssignArgs = {
  agentId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionOnAddContactArgs = {
  contactId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionOnAddSummaryArgs = {
  contactId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionOnAddTranscriptArgs = {
  contactId?: InputMaybe<Scalars['ID']['input']>;
};

export type Transcript = {
  __typename?: 'Transcript';
  PK: Scalars['ID']['output'];
  SK: Scalars['String']['output'];
  begin: Scalars['Int']['output'];
  contactId: Scalars['ID']['output'];
  end: Scalars['Int']['output'];
  isPartial: Scalars['Boolean']['output'];
  participantRole: Scalars['String']['output'];
  transcript: Scalars['String']['output'];
  transcriptId: Scalars['ID']['output'];
};

export type OnAddTranscriptSubscriptionVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;

export type OnAddTranscriptSubscription = {
  __typename?: 'Subscription';
  onAddTranscript?: {
    __typename?: 'Transcript';
    contactId: string;
    transcriptId: string;
    isPartial: boolean;
    participantRole: string;
    begin: number;
    end: number;
    transcript: string;
  } | null;
};

export type OnAddSummarySubscriptionVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;

export type OnAddSummarySubscription = {
  __typename?: 'Subscription';
  onAddSummary?: {
    __typename?: 'Contact';
    contactId: string;
    startDate?: string | null;
    endDate?: string | null;
    summary?: string | null;
  } | null;
};

export type OnAddContactSubscriptionVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;

export type OnAddContactSubscription = {
  __typename?: 'Subscription';
  onAddContact?: {
    __typename?: 'Contact';
    contactId: string;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
};

export type OnAddAssignSubscriptionVariables = Exact<{
  agentId: Scalars['ID']['input'];
}>;

export type OnAddAssignSubscription = {
  __typename?: 'Subscription';
  onAddAssign?: {
    __typename?: 'Assign';
    contactId: string;
    agentId: string;
    agentName?: string | null;
    startDate: string;
    endDate?: string | null;
  } | null;
};

export type CheckTranscriptMutationVariables = Exact<{
  input: CheckTranscriptInput;
}>;

export type CheckTranscriptMutation = {
  __typename?: 'Mutation';
  checkTranscript?: {
    __typename?: 'Contact';
    contactId: string;
    checkResult?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
};

export type AddBotMutationVariables = Exact<{
  input: AddBotInput;
}>;

export type AddBotMutation = {
  __typename?: 'Mutation';
  addBot?: {
    __typename?: 'Bot';
    botId: string;
    botName: string;
    botDescription?: string | null;
    botContents: string;
    active: boolean;
    createdAt: string;
    modifiedAt: string;
  } | null;
};

export type DeleteBotMutationVariables = Exact<{
  input: DeleteBotInput;
}>;

export type DeleteBotMutation = {
  __typename?: 'Mutation';
  deleteBot?: { __typename?: 'DeleteBotResult'; botId: string } | null;
};

export type GetTranscriptsQueryVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;

export type GetTranscriptsQuery = {
  __typename?: 'Query';
  getTranscripts?: Array<{
    __typename?: 'Transcript';
    contactId: string;
    transcriptId: string;
    isPartial: boolean;
    participantRole: string;
    begin: number;
    end: number;
    transcript: string;
  } | null> | null;
};

export type GetContactQueryVariables = Exact<{
  contactId: Scalars['ID']['input'];
}>;

export type GetContactQuery = {
  __typename?: 'Query';
  getContact?: {
    __typename?: 'Contact';
    contactId: string;
    startDate?: string | null;
    endDate?: string | null;
    summary?: string | null;
    checkResult?: string | null;
    cost?: number | null;
  } | null;
};

export type GetContactsQueryVariables = Exact<{
  input?: InputMaybe<GetContactsInput>;
}>;

export type GetContactsQuery = {
  __typename?: 'Query';
  getContacts?: Array<{
    __typename?: 'Contact';
    contactId: string;
    startDate?: string | null;
    endDate?: string | null;
    summary?: string | null;
    checkResult?: string | null;
    cost?: number | null;
  } | null> | null;
};

export type GetAssignsQueryVariables = Exact<{
  input: GetAssignsInput;
}>;

export type GetAssignsQuery = {
  __typename?: 'Query';
  getAssigns?: Array<{
    __typename?: 'Assign';
    contactId: string;
    agentId: string;
    agentName?: string | null;
    startDate: string;
    endDate?: string | null;
  } | null> | null;
};

export type GetBotsQueryVariables = Exact<{ [key: string]: never }>;

export type GetBotsQuery = {
  __typename?: 'Query';
  getBots?: Array<{
    __typename?: 'Bot';
    botId: string;
    botName: string;
    botDescription?: string | null;
    botContents: string;
    active: boolean;
    createdAt: string;
    modifiedAt: string;
  } | null> | null;
};

export const OnAddTranscriptDocument = gql`
  subscription onAddTranscript($contactId: ID!) {
    onAddTranscript(contactId: $contactId) {
      contactId
      transcriptId
      isPartial
      participantRole
      begin
      end
      transcript
    }
  }
`;

/**
 * __useOnAddTranscriptSubscription__
 *
 * To run a query within a React component, call `useOnAddTranscriptSubscription` and pass it any options that fit your needs.
 * When your component renders, `useOnAddTranscriptSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnAddTranscriptSubscription({
 *   variables: {
 *      contactId: // value for 'contactId'
 *   },
 * });
 */
export function useOnAddTranscriptSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<OnAddTranscriptSubscription, OnAddTranscriptSubscriptionVariables> &
    ({ variables: OnAddTranscriptSubscriptionVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<OnAddTranscriptSubscription, OnAddTranscriptSubscriptionVariables>(
    OnAddTranscriptDocument,
    options,
  );
}
export type OnAddTranscriptSubscriptionHookResult = ReturnType<typeof useOnAddTranscriptSubscription>;
export type OnAddTranscriptSubscriptionResult = Apollo.SubscriptionResult<OnAddTranscriptSubscription>;
export const OnAddSummaryDocument = gql`
  subscription onAddSummary($contactId: ID!) {
    onAddSummary(contactId: $contactId) {
      contactId
      startDate
      endDate
      summary
    }
  }
`;

/**
 * __useOnAddSummarySubscription__
 *
 * To run a query within a React component, call `useOnAddSummarySubscription` and pass it any options that fit your needs.
 * When your component renders, `useOnAddSummarySubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnAddSummarySubscription({
 *   variables: {
 *      contactId: // value for 'contactId'
 *   },
 * });
 */
export function useOnAddSummarySubscription(
  baseOptions: Apollo.SubscriptionHookOptions<OnAddSummarySubscription, OnAddSummarySubscriptionVariables> &
    ({ variables: OnAddSummarySubscriptionVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<OnAddSummarySubscription, OnAddSummarySubscriptionVariables>(
    OnAddSummaryDocument,
    options,
  );
}
export type OnAddSummarySubscriptionHookResult = ReturnType<typeof useOnAddSummarySubscription>;
export type OnAddSummarySubscriptionResult = Apollo.SubscriptionResult<OnAddSummarySubscription>;
export const OnAddContactDocument = gql`
  subscription onAddContact($contactId: ID!) {
    onAddContact(contactId: $contactId) {
      contactId
      startDate
      endDate
    }
  }
`;

/**
 * __useOnAddContactSubscription__
 *
 * To run a query within a React component, call `useOnAddContactSubscription` and pass it any options that fit your needs.
 * When your component renders, `useOnAddContactSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnAddContactSubscription({
 *   variables: {
 *      contactId: // value for 'contactId'
 *   },
 * });
 */
export function useOnAddContactSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<OnAddContactSubscription, OnAddContactSubscriptionVariables> &
    ({ variables: OnAddContactSubscriptionVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<OnAddContactSubscription, OnAddContactSubscriptionVariables>(
    OnAddContactDocument,
    options,
  );
}
export type OnAddContactSubscriptionHookResult = ReturnType<typeof useOnAddContactSubscription>;
export type OnAddContactSubscriptionResult = Apollo.SubscriptionResult<OnAddContactSubscription>;
export const OnAddAssignDocument = gql`
  subscription onAddAssign($agentId: ID!) {
    onAddAssign(agentId: $agentId) {
      contactId
      agentId
      agentName
      startDate
      endDate
    }
  }
`;

/**
 * __useOnAddAssignSubscription__
 *
 * To run a query within a React component, call `useOnAddAssignSubscription` and pass it any options that fit your needs.
 * When your component renders, `useOnAddAssignSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnAddAssignSubscription({
 *   variables: {
 *      agentId: // value for 'agentId'
 *   },
 * });
 */
export function useOnAddAssignSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<OnAddAssignSubscription, OnAddAssignSubscriptionVariables> &
    ({ variables: OnAddAssignSubscriptionVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<OnAddAssignSubscription, OnAddAssignSubscriptionVariables>(
    OnAddAssignDocument,
    options,
  );
}
export type OnAddAssignSubscriptionHookResult = ReturnType<typeof useOnAddAssignSubscription>;
export type OnAddAssignSubscriptionResult = Apollo.SubscriptionResult<OnAddAssignSubscription>;
export const CheckTranscriptDocument = gql`
  mutation checkTranscript($input: CheckTranscriptInput!) {
    checkTranscript(input: $input) {
      contactId
      checkResult
      startDate
      endDate
    }
  }
`;
export type CheckTranscriptMutationFn = Apollo.MutationFunction<
  CheckTranscriptMutation,
  CheckTranscriptMutationVariables
>;

/**
 * __useCheckTranscriptMutation__
 *
 * To run a mutation, you first call `useCheckTranscriptMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCheckTranscriptMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [checkTranscriptMutation, { data, loading, error }] = useCheckTranscriptMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCheckTranscriptMutation(
  baseOptions?: Apollo.MutationHookOptions<CheckTranscriptMutation, CheckTranscriptMutationVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<CheckTranscriptMutation, CheckTranscriptMutationVariables>(
    CheckTranscriptDocument,
    options,
  );
}
export type CheckTranscriptMutationHookResult = ReturnType<typeof useCheckTranscriptMutation>;
export type CheckTranscriptMutationResult = Apollo.MutationResult<CheckTranscriptMutation>;
export type CheckTranscriptMutationOptions = Apollo.BaseMutationOptions<
  CheckTranscriptMutation,
  CheckTranscriptMutationVariables
>;
export const AddBotDocument = gql`
  mutation addBot($input: AddBotInput!) {
    addBot(input: $input) {
      botId
      botName
      botDescription
      botContents
      active
      createdAt
      modifiedAt
    }
  }
`;
export type AddBotMutationFn = Apollo.MutationFunction<AddBotMutation, AddBotMutationVariables>;

/**
 * __useAddBotMutation__
 *
 * To run a mutation, you first call `useAddBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addBotMutation, { data, loading, error }] = useAddBotMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAddBotMutation(baseOptions?: Apollo.MutationHookOptions<AddBotMutation, AddBotMutationVariables>) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<AddBotMutation, AddBotMutationVariables>(AddBotDocument, options);
}
export type AddBotMutationHookResult = ReturnType<typeof useAddBotMutation>;
export type AddBotMutationResult = Apollo.MutationResult<AddBotMutation>;
export type AddBotMutationOptions = Apollo.BaseMutationOptions<AddBotMutation, AddBotMutationVariables>;
export const DeleteBotDocument = gql`
  mutation deleteBot($input: DeleteBotInput!) {
    deleteBot(input: $input) {
      botId
    }
  }
`;
export type DeleteBotMutationFn = Apollo.MutationFunction<DeleteBotMutation, DeleteBotMutationVariables>;

/**
 * __useDeleteBotMutation__
 *
 * To run a mutation, you first call `useDeleteBotMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteBotMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteBotMutation, { data, loading, error }] = useDeleteBotMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useDeleteBotMutation(
  baseOptions?: Apollo.MutationHookOptions<DeleteBotMutation, DeleteBotMutationVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useMutation<DeleteBotMutation, DeleteBotMutationVariables>(DeleteBotDocument, options);
}
export type DeleteBotMutationHookResult = ReturnType<typeof useDeleteBotMutation>;
export type DeleteBotMutationResult = Apollo.MutationResult<DeleteBotMutation>;
export type DeleteBotMutationOptions = Apollo.BaseMutationOptions<DeleteBotMutation, DeleteBotMutationVariables>;
export const GetTranscriptsDocument = gql`
  query getTranscripts($contactId: ID!) {
    getTranscripts(contactId: $contactId) {
      contactId
      transcriptId
      isPartial
      participantRole
      begin
      end
      transcript
    }
  }
`;

/**
 * __useGetTranscriptsQuery__
 *
 * To run a query within a React component, call `useGetTranscriptsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetTranscriptsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetTranscriptsQuery({
 *   variables: {
 *      contactId: // value for 'contactId'
 *   },
 * });
 */
export function useGetTranscriptsQuery(
  baseOptions: Apollo.QueryHookOptions<GetTranscriptsQuery, GetTranscriptsQueryVariables> &
    ({ variables: GetTranscriptsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetTranscriptsQuery, GetTranscriptsQueryVariables>(GetTranscriptsDocument, options);
}
export function useGetTranscriptsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<GetTranscriptsQuery, GetTranscriptsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetTranscriptsQuery, GetTranscriptsQueryVariables>(GetTranscriptsDocument, options);
}
export function useGetTranscriptsSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<GetTranscriptsQuery, GetTranscriptsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetTranscriptsQuery, GetTranscriptsQueryVariables>(GetTranscriptsDocument, options);
}
export type GetTranscriptsQueryHookResult = ReturnType<typeof useGetTranscriptsQuery>;
export type GetTranscriptsLazyQueryHookResult = ReturnType<typeof useGetTranscriptsLazyQuery>;
export type GetTranscriptsSuspenseQueryHookResult = ReturnType<typeof useGetTranscriptsSuspenseQuery>;
export type GetTranscriptsQueryResult = Apollo.QueryResult<GetTranscriptsQuery, GetTranscriptsQueryVariables>;
export const GetContactDocument = gql`
  query getContact($contactId: ID!) {
    getContact(contactId: $contactId) {
      contactId
      startDate
      endDate
      summary
      checkResult
      cost
    }
  }
`;

/**
 * __useGetContactQuery__
 *
 * To run a query within a React component, call `useGetContactQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetContactQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetContactQuery({
 *   variables: {
 *      contactId: // value for 'contactId'
 *   },
 * });
 */
export function useGetContactQuery(
  baseOptions: Apollo.QueryHookOptions<GetContactQuery, GetContactQueryVariables> &
    ({ variables: GetContactQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetContactQuery, GetContactQueryVariables>(GetContactDocument, options);
}
export function useGetContactLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<GetContactQuery, GetContactQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetContactQuery, GetContactQueryVariables>(GetContactDocument, options);
}
export function useGetContactSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<GetContactQuery, GetContactQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetContactQuery, GetContactQueryVariables>(GetContactDocument, options);
}
export type GetContactQueryHookResult = ReturnType<typeof useGetContactQuery>;
export type GetContactLazyQueryHookResult = ReturnType<typeof useGetContactLazyQuery>;
export type GetContactSuspenseQueryHookResult = ReturnType<typeof useGetContactSuspenseQuery>;
export type GetContactQueryResult = Apollo.QueryResult<GetContactQuery, GetContactQueryVariables>;
export const GetContactsDocument = gql`
  query getContacts($input: GetContactsInput) {
    getContacts(input: $input) {
      contactId
      startDate
      endDate
      summary
      checkResult
      cost
    }
  }
`;

/**
 * __useGetContactsQuery__
 *
 * To run a query within a React component, call `useGetContactsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetContactsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetContactsQuery({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useGetContactsQuery(
  baseOptions?: Apollo.QueryHookOptions<GetContactsQuery, GetContactsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetContactsQuery, GetContactsQueryVariables>(GetContactsDocument, options);
}
export function useGetContactsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<GetContactsQuery, GetContactsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetContactsQuery, GetContactsQueryVariables>(GetContactsDocument, options);
}
export function useGetContactsSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<GetContactsQuery, GetContactsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetContactsQuery, GetContactsQueryVariables>(GetContactsDocument, options);
}
export type GetContactsQueryHookResult = ReturnType<typeof useGetContactsQuery>;
export type GetContactsLazyQueryHookResult = ReturnType<typeof useGetContactsLazyQuery>;
export type GetContactsSuspenseQueryHookResult = ReturnType<typeof useGetContactsSuspenseQuery>;
export type GetContactsQueryResult = Apollo.QueryResult<GetContactsQuery, GetContactsQueryVariables>;
export const GetAssignsDocument = gql`
  query getAssigns($input: GetAssignsInput!) {
    getAssigns(input: $input) {
      contactId
      agentId
      agentName
      startDate
      endDate
    }
  }
`;

/**
 * __useGetAssignsQuery__
 *
 * To run a query within a React component, call `useGetAssignsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAssignsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAssignsQuery({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useGetAssignsQuery(
  baseOptions: Apollo.QueryHookOptions<GetAssignsQuery, GetAssignsQueryVariables> &
    ({ variables: GetAssignsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetAssignsQuery, GetAssignsQueryVariables>(GetAssignsDocument, options);
}
export function useGetAssignsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<GetAssignsQuery, GetAssignsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetAssignsQuery, GetAssignsQueryVariables>(GetAssignsDocument, options);
}
export function useGetAssignsSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<GetAssignsQuery, GetAssignsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetAssignsQuery, GetAssignsQueryVariables>(GetAssignsDocument, options);
}
export type GetAssignsQueryHookResult = ReturnType<typeof useGetAssignsQuery>;
export type GetAssignsLazyQueryHookResult = ReturnType<typeof useGetAssignsLazyQuery>;
export type GetAssignsSuspenseQueryHookResult = ReturnType<typeof useGetAssignsSuspenseQuery>;
export type GetAssignsQueryResult = Apollo.QueryResult<GetAssignsQuery, GetAssignsQueryVariables>;
export const GetBotsDocument = gql`
  query getBots {
    getBots {
      botId
      botName
      botDescription
      botContents
      active
      createdAt
      modifiedAt
    }
  }
`;

/**
 * __useGetBotsQuery__
 *
 * To run a query within a React component, call `useGetBotsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBotsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBotsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetBotsQuery(baseOptions?: Apollo.QueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
}
export function useGetBotsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBotsQuery, GetBotsQueryVariables>) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
}
export function useGetBotsSuspenseQuery(
  baseOptions?: Apollo.SuspenseQueryHookOptions<GetBotsQuery, GetBotsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<GetBotsQuery, GetBotsQueryVariables>(GetBotsDocument, options);
}
export type GetBotsQueryHookResult = ReturnType<typeof useGetBotsQuery>;
export type GetBotsLazyQueryHookResult = ReturnType<typeof useGetBotsLazyQuery>;
export type GetBotsSuspenseQueryHookResult = ReturnType<typeof useGetBotsSuspenseQuery>;
export type GetBotsQueryResult = Apollo.QueryResult<GetBotsQuery, GetBotsQueryVariables>;
