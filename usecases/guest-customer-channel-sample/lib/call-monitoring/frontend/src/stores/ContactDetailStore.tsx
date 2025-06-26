import React, { ReactNode, createContext } from 'react';
import { useContext, useEffect } from 'react';
import {
  Transcript,
  useCheckTranscriptMutation,
  useGetContactLazyQuery,
  useGetTranscriptsLazyQuery,
  useOnAddContactSubscription,
  useOnAddSummarySubscription,
  useOnAddTranscriptSubscription,
} from '@/graphql/generated';
import useContactDetailReducer, { Action, State } from './useContactDetailReducer';
import { ConnectContext } from '@/providers/ConnectProvider';

interface ContactDetailStoreProviderProps {
  children: ReactNode;
}

interface Store {
  state: State;
  dispatch: React.Dispatch<Action>;
  loadContact: (contactId: string) => void;
  checkTranscript: (contactId: string) => void;
  clear: () => void;
}

const ContactDetailStore = createContext({} as Store);

const ContactDetailStoreProvider: React.FC<ContactDetailStoreProviderProps> = ({ children }) => {
  const { state, dispatch } = useContactDetailReducer();
  const { contactId } = useContext(ConnectContext);

  /*
   * 文字起こしデータ履歴を取得 (Query)
   */
  const [_getTranscripts, { data: transcripts }] = useGetTranscriptsLazyQuery({
    fetchPolicy: 'no-cache',
  });
  useEffect(() => {
    if (transcripts && transcripts.getTranscripts) {
      const concatTranscripts = getConcatTranscripts(transcripts.getTranscripts as Transcript[], state.transcripts);
      dispatch({ type: 'receive-transcripts', payload: concatTranscripts });
    }
  }, [transcripts]);

  /*
   * コンプライアンスチェック結果と Bedrock による要約の履歴を取得 (Query)
   */
  const [_getContact, { data: contact }] = useGetContactLazyQuery({
    fetchPolicy: 'no-cache',
  });
  useEffect(() => {
    if (contact && contact.getContact) {
      dispatch({ type: 'receive-summary', payload: contact.getContact.summary ?? '' });
      if (contact.getContact.checkResult) {
        const json = parseCheckResult(contact.getContact.checkResult ?? '');
        dispatch({ type: 'receive-check-result', payload: json });
      }
      if (contact.getContact.endDate) {
        dispatch({ type: 'call-end' });
      } else {
        dispatch({ type: 'call-start' });
      }
    }
  }, [contact]);

  /*
   * Bedrock によるコンプライアンスチェックを実行 (Mutation)
   */
  const [_checkTranscript, { data: checkResult, error: checkResultError }] = useCheckTranscriptMutation();
  useEffect(() => {
    if (checkResultError) {
      dispatch({ type: 'receive-check-result-error', payload: checkResultError });
      return;
    }
    if (checkResult && checkResult.checkTranscript?.checkResult) {
      const json = parseCheckResult(checkResult.checkTranscript.checkResult);
      dispatch({ type: 'receive-check-result', payload: json });
    }
  }, [checkResult, checkResultError]);

  const parseCheckResult = (text: string) => {
    try {
      const json: CheckResult = JSON.parse(text);
      // alert が先頭に来るようにソート
      json.sort((a, b) => {
        if (a.importance === 'alert') {
          return b.importance === 'alert' ? 0 : -1;
        } else {
          return 1;
        }
      });
      return json;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      console.log('parse error');
      return [{ label: '回答', confirmed: true, importance: '', answer: text, source: null }];
    }
  };

  /*
   * Contact をサブスクライブ (Subscription)
   * call の開始・終了を監視
   */
  const { data: _contact } = useOnAddContactSubscription({
    variables: {
      contactId,
    },
  });
  useEffect(() => {
    if (_contact && _contact.onAddContact) {
      if (_contact.onAddContact.endDate) {
        dispatch({ type: 'call-end' });
      } else if (_contact.onAddContact.startDate) {
        dispatch({ type: 'call-start' });
      }
    }
  }, [_contact]);

  /*
   * Bedrock による要約をサブスクライブ (Subscription)
   */
  const { data: _summary } = useOnAddSummarySubscription({
    variables: {
      contactId,
    },
  });
  useEffect(() => {
    dispatch({ type: 'receive-summary', payload: _summary?.onAddSummary?.summary ?? '' });
  }, [_summary]);

  // 既存の文字起こしデータと新しい文字起こしデータを結合する
  // isPartial の値によって結合処理が異なる
  const getConcatTranscripts = (payload: Transcript[], currentTranscripts: Transcript[]) => {
    let concatTranscripts = [...currentTranscripts];
    payload.forEach((latestTranscript) => {
      const filtered = concatTranscripts.filter(
        (transcript) => transcript.transcriptId === latestTranscript.transcriptId,
      );
      if (filtered.length > 0) {
        if (latestTranscript.isPartial === false) {
          // isPartial = false が来た時点で partial = true のデータを削除して partial = false のデータを追加する
          // remove partial transcripts
          concatTranscripts = concatTranscripts.filter(
            (transcript) => transcript.transcriptId !== latestTranscript.transcriptId,
          );
          // add completed transcript
          concatTranscripts.push(latestTranscript);
        } else {
          // isPartial = true が来たら、既存の transcripts の中に partial = false のデータがなければデータを追加する
          const completed = filtered.find((transcript) => {
            return transcript.isPartial === false;
          });
          if (!completed) {
            // add completed transcript
            concatTranscripts.push(latestTranscript);
          }
        }
      } else {
        concatTranscripts.push(latestTranscript);
      }
    });
    return concatTranscripts;
  };

  /*
   * ライブ文字起こしをサブスクライブ (Subscription)
   */
  const { data: transcript } = useOnAddTranscriptSubscription({
    variables: {
      contactId,
    },
  });
  useEffect(() => {
    if (transcript && transcript.onAddTranscript) {
      const concatTranscripts = getConcatTranscripts([transcript.onAddTranscript] as Transcript[], state.transcripts);
      dispatch({ type: 'receive-transcripts', payload: concatTranscripts });
      if (transcript.onAddTranscript.isPartial === false && transcript.onAddTranscript.participantRole === 'AGENT') {
        console.log('compliance check start');
        // Agent の発話が完了したらコンプライアンスチェックを実行
        // TODO: チェック機能をどのタイミングから開始するかなどは要件によって変更する
        // check 実行中はスキップする
        if (state.checking) {
          return;
        }
        checkTranscript(contactId);
      }
    }
  }, [transcript]);

  const loadContact = (contactId: string) => {
    _getTranscripts({ variables: { contactId } });
    dispatch({ type: 'load-transcripts' }); // loading state update
    _getContact({ variables: { contactId } });
    dispatch({ type: 'load-summary' }); // loading state update
  };

  const checkTranscript = (contactId: string) => {
    _checkTranscript({
      variables: {
        input: {
          contactId,
        },
      },
    });
    dispatch({ type: 'check-transcript' }); // loading state update
  };

  const clear = () => {
    dispatch({ type: 'clear' });
  };

  return (
    <ContactDetailStore.Provider value={{ state, dispatch, loadContact, checkTranscript, clear }}>
      {children}
    </ContactDetailStore.Provider>
  );
};

export type CheckResult = {
  label: string;
  confirmed: boolean;
  importance: string;
  answer?: string;
  source: string | null;
}[];

export { ContactDetailStoreProvider, ContactDetailStore };
