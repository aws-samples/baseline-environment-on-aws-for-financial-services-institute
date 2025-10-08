import React, { ReactNode, createContext } from 'react';
import { useEffect } from 'react';
import { Bot, useAddBotMutation, useDeleteBotMutation, useGetBotsLazyQuery } from '@/graphql/generated';
import useBotReducer, { Action, State } from './useBotReducer';

interface BotStoreProviderProps {
  children: ReactNode;
}

interface Store {
  state: State;
  dispatch: React.Dispatch<Action>;
  addBot: (bot: Partial<Bot>) => void;
  deleteBot: (botId: string) => void;
  getBots: () => void;
}

const BotStore = createContext({} as Store);

const BotStoreProvider: React.FC<BotStoreProviderProps> = ({ children }) => {
  const { state, dispatch } = useBotReducer();

  /*
   * Bots を取得 (Query)
   */
  // TODO: cache and useEffect
  const [_getBots, { data: bots }] = useGetBotsLazyQuery({
    fetchPolicy: 'no-cache',
  });
  useEffect(() => {
    if (bots?.getBots) {
      dispatch({ type: 'receive-bots', payload: bots.getBots as Bot[] });
    }
  }, [bots]);

  /*
   * Bot を作成・編集 (Mutation)
   */
  const [_addBot, { data: addedBot }] = useAddBotMutation();
  useEffect(() => {
    if (addedBot?.addBot) {
      dispatch({ type: 'receive-added-bot', payload: addedBot.addBot as Bot });
    }
  }, [addedBot]);

  const addBot = (bot: Partial<Bot>) => {
    _addBot({
      variables: {
        input: {
          ...(bot as Bot),
        },
      },
    });
    dispatch({ type: 'add-bot' });
  };

  /*
   * Bot を削除 (Mutation)
   */
  const [_deleteBot, { data: deletedBot }] = useDeleteBotMutation();
  useEffect(() => {
    if (deletedBot?.deleteBot) {
      dispatch({ type: 'receive-deleted-bot', payload: deletedBot.deleteBot.botId });
    }
  }, [deletedBot]);

  const deleteBot = (botId: string) => {
    _deleteBot({
      variables: {
        input: {
          botId,
        },
      },
    });
    dispatch({ type: 'delete-bot' });
  };

  const getBots = () => {
    _getBots({ variables: {} });
    dispatch({ type: 'get-bots' });
  };

  return <BotStore.Provider value={{ state, dispatch, addBot, deleteBot, getBots }}>{children}</BotStore.Provider>;
};

export { BotStoreProvider, BotStore };
