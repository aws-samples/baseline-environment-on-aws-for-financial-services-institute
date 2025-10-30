import { useReducer } from 'react';
import { Bot } from '@/graphql/generated';

export type State = {
  bots: Bot[];
  loading: boolean;
};

export type Action =
  | { type: 'get-bots' }
  | { type: 'receive-bots'; payload: Bot[] }
  | { type: 'add-bot' }
  | { type: 'receive-added-bot'; payload: Bot }
  | { type: 'delete-bot' }
  | { type: 'receive-deleted-bot'; payload: string };

function useBotReducer() {
  /*
   * 初期 State
   */
  const initialState = {
    bots: [],
    loading: false,
  };

  const reducer = (state: State, action: Action) => {
    switch (action.type) {
      case 'get-bots':
        return {
          ...state,
          loading: true,
        };
      case 'receive-bots':
        return {
          ...state,
          bots: action.payload,
          loading: false,
        };
      case 'add-bot':
        return {
          ...state,
          loading: true,
        };
      case 'receive-added-bot':
        // eslint-disable-next-line no-case-declarations
        const currentBots = [...state.bots];
        // eslint-disable-next-line no-case-declarations
        const found = currentBots.find((bot) => bot.botId === action.payload.botId);
        if (found) {
          Object.assign(found, action.payload);
        } else {
          currentBots.push(action.payload);
        }
        return {
          ...state,
          bots: currentBots,
          loading: false,
        };
      case 'delete-bot':
        return {
          ...state,
          loading: true,
        };
      case 'receive-deleted-bot':
        return {
          ...state,
          bots: [...state.bots].filter((bot) => bot.botId !== action.payload),
          loading: false,
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
export default useBotReducer;
