import { useReducer } from 'react';
import { Assign } from '@/graphql/generated';

export type State = {
  assigns: Assign[];
  loading: boolean;
};

export type Action = { type: 'load-assigns' } | { type: 'receive-assigns'; payload: Assign[] } | { type: 'clear' };

function useContactReducer() {
  /* 
  const mocks: Assign[] = [
    {
      contactId: 'd1452798-64aa-46d1-8cc8-f53167b5ba81',
      startDate: '2024-06-04T13:22:05.481Z',
      endDate: null,
      type: 'Assign',
    },
    {
      contactId: '3e83cef7-8a9e-48fc-bc46-37578e15d095',
      startDate: '2024-06-04T14:33:23.875Z',
      endDate: null,
      type: 'Assign',
    },
    {
      contactId: 'd86ce7be-090a-41c8-898b-d3f2dce08a23',
      startDate: '2024-06-04T14:56:24.130Z',
      endDate: null,
      type: 'Assign',
    },
    {
      contactId: '5a5efb2d-9397-478b-b86d-07cbc2ad6d68',
      startDate: '2024-06-04T15:38:51.357Z',
      endDate: '2024-06-04T15:39:20.202Z',
      type: 'Assign',
    },
    {
      contactId: 'a2a82409-2a2d-401d-a7f0-b3f0db535616',
      startDate: '2024-06-05T04:07:43.944Z',
      endDate: '2024-06-05T04:08:10.924Z',
      type: 'Assign',
    },
    {
      contactId: 'a2814a4a-a80a-43aa-945f-e7f1912eb669',
      startDate: '2024-06-05T05:52:51.931Z',
      endDate: '2024-06-05T05:54:56.051Z',
      type: 'Assign',
      __typename: 'Assign',
    },
  ] as Assign[];
  */

  /*
   * 初期 State
   */
  const initialState = {
    assigns: [],
    loading: false,
  };

  const reducer = (state: State, action: Action) => {
    switch (action.type) {
      case 'load-assigns':
        return {
          ...state,
          loading: true,
        };
      case 'receive-assigns':
        return {
          ...state,
          assigns: action.payload, // reversed history
          loading: false,
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
export default useContactReducer;
