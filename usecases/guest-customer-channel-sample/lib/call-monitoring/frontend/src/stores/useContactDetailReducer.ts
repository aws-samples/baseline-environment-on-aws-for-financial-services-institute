import { useReducer } from 'react';
import { Transcript } from '@/graphql/generated';
import { CheckResult } from './ContactDetailStore';
import { ApolloError } from '@apollo/client';

export type State = {
  transcripts: Transcript[];
  loading: boolean;
  summary: string;
  checkResult: CheckResult | null;
  checkResultError: ApolloError | null;
  checking: boolean;
  calling: boolean;
};

export type Action =
  | { type: 'load-transcripts' }
  | { type: 'receive-transcripts'; payload: Transcript[] }
  | { type: 'load-summary' }
  | { type: 'receive-summary'; payload: string }
  | { type: 'check-transcript' }
  | { type: 'receive-check-result'; payload: CheckResult }
  | { type: 'receive-check-result-error'; payload: ApolloError }
  | { type: 'call-start' }
  | { type: 'call-end' }
  | { type: 'clear' };

function useContactDetailReducer() {
  /*
   * 初期 State
   */
  const initialState = {
    transcripts: [],
    loading: false,
    summary: '',
    loadingSummary: false,
    checkResult: null,
    checkResultError: null,
    checking: false,
    calling: false,
  };

  const reducer = (state: State, action: Action) => {
    switch (action.type) {
      case 'load-transcripts':
        return {
          ...state,
          loading: true,
        };
      case 'receive-transcripts':
        return {
          ...state,
          transcripts: action.payload,
          loading: false,
        };
      case 'load-summary':
        return {
          ...state,
          loadingSummary: true,
        };
      case 'receive-summary':
        return {
          ...state,
          summary: action.payload,
          loadingSummary: false,
        };
      case 'check-transcript':
        return {
          ...state,
          checking: true,
          checkResultError: null,
        };
      case 'receive-check-result':
        return {
          ...state,
          checking: false,
          checkResult: action.payload,
        };
      case 'receive-check-result-error':
        return {
          ...state,
          checking: false,
          checkResult: null,
          checkResultError: action.payload,
        };
      case 'call-start':
        return {
          ...state,
          calling: true,
        };
      case 'call-end':
        return {
          ...state,
          calling: false,
        };
      case 'clear':
        return {
          ...initialState,
        };
      default:
        return {
          ...state,
        };
    }
  };
  const [state, dispatch] = useReducer(reducer, initialState);
  return { state, dispatch } as const;
}
export default useContactDetailReducer;
