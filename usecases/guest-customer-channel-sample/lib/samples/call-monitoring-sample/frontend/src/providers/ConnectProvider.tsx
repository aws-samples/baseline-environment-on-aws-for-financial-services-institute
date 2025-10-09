import React, { ReactNode, createContext, useState, useEffect } from 'react';
import {
  AgentClient,
  AgentStateChanged,
  ContactClient,
  ContactConnected,
  ContactConnectedHandler,
} from '@amazon-connect/contact';
import { AmazonConnectApp } from '@amazon-connect/app';

interface ProviderProps {
  children: ReactNode;
}

interface UseState {
  initialized: boolean;
  setInitialized: (initialized: boolean) => void;
  contactId: string;
  setContactId: (contactId: string) => void;
  currentContactId: string;
  setCurrentContactId: (contactId: string) => void;
  originalContactId: string;
  setOriginalContactId: (contactId: string) => void;
  agentState: AgentStateChanged | null;
  setAgentState: (agentState: AgentStateChanged) => void;
  agentId: string;
  setAgentId: (agentId: string) => void;
  agentName: string;
  setAgentName: (agentName: string) => void;
}

const ConnectContext = createContext({} as UseState);

/*
 * Amazon Connect のエージェント状態やコンタクト（通話）のイベントを管理する Provider
 *
 * 本プロトタイプでは、Agent Workspace の 3rd party app として実装します。
 * @amazon-connect/contact の AgentClient と ContactClient を使用して、エージェントの状態やコンタクトイベントを取得します。
 * 参考：
 * https://docs.aws.amazon.com/ja_jp/agentworkspace/latest/devguide/getting-started.html
 *
 * プロトタイプを Agent Workspace の 3rd party app ではなく Custom CCP として作成する場合は、
 * Amazon Connect Streams API を使用し、エージェントの状態やコンタクトイベントを取得してください。
 * 参考：
 * https://github.com/amazon-connect/amazon-connect-streams/
 */
const ConnectProvider: React.FC<ProviderProps> = ({ children }) => {
  // Amazon Connect App (or Custom CCP) の初期化が完了したかどうか
  const [initialized, setInitialized] = useState<boolean>(false);
  // Live Transcription 対象のコールID
  const [contactId, setContactId] = useState<string>('');
  // 現在のコールID
  const [currentContactId, setCurrentContactId] = useState<string>('');
  // 転送元のコールID
  const [originalContactId, setOriginalContactId] = useState<string>('');
  // Agent の状態
  const [agentState, setAgentState] = useState<AgentStateChanged | null>(null);
  // Agent ID
  const [agentId, setAgentId] = useState<string>('');
  // Agent 名
  const [agentName, setAgentName] = useState<string>('');

  const agentClient = new AgentClient();
  const contactClient = new ContactClient();

  // Amazon Connect App の初期化
  useEffect(() => {
    AmazonConnectApp.init({
      onCreate: async (event) => {
        setInitialized(true);
        console.log('Amazon Connect App initialized');

        // イベントハンドラは初期化以降に発生したイベントしか取得できないため、初期値をここで取得する
        const { contactScope } = event.context;
        // onCreate/ onDestroy はコールの都度呼ばれる
        // 前回のコールの contactId を維持したいため、initContactId は新規の値が来た場合のみ呼び出す
        if (contactScope?.contactId) {
          await initContactId(contactScope.contactId);
        }
        console.log('init contactId:', { contactScope });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // There is a type bug in the library. The return value of getState() return state, not name and agentStateARN.
        const { state } = await agentClient.getState();
        const currentState: AgentStateChanged = {
          state: state.name,
          previous: {
            state: '',
          },
        };
        setAgentState(currentState);
        console.log('init agentState:', currentState);

        const arn = await agentClient.getARN();
        const arnParts = arn.split('/') ?? [];
        if (arnParts.length > 0) {
          setAgentId(arnParts[arnParts.length - 1]);
        }
        const name = await agentClient.getName();
        setAgentName(name);
      },
      onDestroy: async () => {
        console.log('Amazon Connect App being destroyed');
      },
    });
  }, []);

  // Connect イベントハンドラ
  useEffect(() => {
    if (initialized) {
      const agentEventHandler = async (data: AgentStateChanged) => {
        console.log('agentEventHandler called:', data);
        setAgentState(data);
      };

      const contactConnectHandler: ContactConnectedHandler = async (data: ContactConnected) => {
        console.log('contactConnectHandler called:', data);
        // コール終了後 contactId を維持したいため、新しいコールが始まった場合のみ initContactId を呼び出す
        if (data.contactId) {
          await initContactId(data.contactId);
        }
      };

      console.log('onEventHandler called');
      agentClient.onStateChanged(agentEventHandler);
      contactClient.onConnected(contactConnectHandler);

      return () => {
        console.log('offEventHandler called');
        agentClient.offStateChanged(agentEventHandler);
        contactClient.offConnected(contactConnectHandler);
      };
    }
  }, [initialized]);

  // Current ContactId を元に Original ContactId を取得し、優先 contactId を設定する
  const initContactId = async (id: string): Promise<void> => {
    setCurrentContactId(id);

    // コールの全属性を取得
    const attributes = await contactClient.getAttributes(id, '*');
    console.log('getAttributes called:', attributes ? JSON.stringify(attributes) : null);

    // orgContactId という属性値を取得 (転送フローで contactId が設定された値)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // There is a type bug of orgContactId. The return value of orgContactId doesn't compliant Record<string, string>.
    const orgContactId = attributes['orgContactId']?.value ?? '';
    if (orgContactId && orgContactId !== id) {
      setOriginalContactId(orgContactId);
      // originalContactId を優先して Live Transcription 対象のコールIDに設定する
      setContactId(orgContactId);
    } else {
      setContactId(id);
    }
    return;
  };

  const state = {
    initialized,
    setInitialized,
    contactId,
    setContactId,
    currentContactId,
    setCurrentContactId,
    originalContactId,
    setOriginalContactId,
    agentState,
    setAgentState,
    agentId,
    setAgentId,
    agentName,
    setAgentName,
  };
  return <ConnectContext.Provider value={state}>{children}</ConnectContext.Provider>;
};

export { ConnectContext, ConnectProvider };
