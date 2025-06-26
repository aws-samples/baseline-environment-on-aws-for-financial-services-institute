import React, { ReactNode, createContext, useContext } from 'react';
import { useEffect } from 'react';
import { Assign, useGetAssignsLazyQuery, useOnAddAssignSubscription } from '@/graphql/generated';
import useContactReducer, { Action, State } from './useContactReducer';
import { ConnectContext } from '@/providers/ConnectProvider';

interface ContactStoreProviderProps {
  children: ReactNode;
}

interface Store {
  state: State;
  dispatch: React.Dispatch<Action>;
  loadAssigns: (agentId: string) => void;
  clear: () => void;
}

const ContactStore = createContext({} as Store);

const ContactStoreProvider: React.FC<ContactStoreProviderProps> = ({ children }) => {
  const { state, dispatch } = useContactReducer();
  const { agentId } = useContext(ConnectContext);

  /*
   * エージェントの Contact 一覧を取得 (Query)
   */
  const [_getAssigns, { data: assigns }] = useGetAssignsLazyQuery({
    fetchPolicy: 'no-cache',
  });
  useEffect(() => {
    if (assigns && assigns.getAssigns) {
      dispatch({ type: 'receive-assigns', payload: assigns.getAssigns as Assign[] });
    }
  }, [assigns]);

  /*
   * エージェントの通話終了をサブスクライブ (Subscription)
   */
  const { data: assign } = useOnAddAssignSubscription({
    variables: {
      agentId,
    },
  });
  useEffect(() => {
    if (assign && assign.onAddAssign && assign.onAddAssign.endDate) {
      loadAssigns(agentId);
    }
  }, [assign]);

  const loadAssigns = (agentId: string) => {
    _getAssigns({ variables: { input: { agentId, reverse: true, limit: 10 } } }); // top 10 latest history
    dispatch({ type: 'load-assigns' }); // loading state update
  };

  const clear = () => {
    dispatch({ type: 'clear' });
  };

  return <ContactStore.Provider value={{ state, dispatch, loadAssigns, clear }}>{children}</ContactStore.Provider>;
};

export { ContactStoreProvider, ContactStore };
