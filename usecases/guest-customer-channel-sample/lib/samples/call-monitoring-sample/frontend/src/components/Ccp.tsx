import { useContext, useEffect } from 'react';
import { ConnectContext } from '@/providers/ConnectProvider';
import 'amazon-connect-streams';

export default function Ccp() {
  const {
    initialized,
    setInitialized,
    setAgentState,
    setAgentName,
    setAgentId,
    setCurrentContactId,
    setOriginalContactId,
    setContactId,
  } = useContext(ConnectContext);

  // Amazon Connect CCP の初期化
  useEffect(() => {
    connect.core.initCCP(document.querySelector('#ccp')!, {
      ccpUrl: `${import.meta.env.VITE_CONNECT_URL}/ccp-v2`,
      loginPopup: true,
      loginPopupAutoClose: true,
      loginOptions: {
        autoClose: true,
      },
      region: import.meta.env.VITE_REGION,
      softphone: {
        allowFramedSoftphone: true,
        disableRingtone: false,
      },
    });

    connect.agent((agent: connect.Agent) => {
      const config = agent.getConfiguration();
      setAgentName(config.name);
      setAgentId(config.agentARN.split('/').pop()!); // agent ARN の最後の部分が agentId

      // State change handler
      agent.onStateChange((agent) => {
        setAgentState({
          state: agent.newState,
          previous: {
            state: agent.oldState,
          },
        });
      });

      setInitialized(true);
      console.log('Amazon Connect CCP initialized');
    });

    connect.contact((contact: connect.Contact) => {
      // コールIDを取得
      const id = contact.contactId;
      setCurrentContactId(id);

      // コールの全属性を取得
      const attributes = contact.getAttributes();
      // orgContactId という属性値を取得 (転送フローで contactId が設定された値)
      const orgContactId = attributes['orgContactId']?.value ?? '';
      if (orgContactId && orgContactId !== id) {
        setOriginalContactId(orgContactId);
        // originalContactId を優先して Live Transcription 対象のコールIDに設定する
        setContactId(orgContactId);
      } else {
        setContactId(id);
      }
    });

    return () => {
      if (initialized) {
        connect.core.terminate();
        setInitialized(false);
        document.querySelector('#ccp')!.innerHTML = '';
        console.log('Amazon Connect CCP being destroyed');
      }
    };
  }, []);

  return <div id="ccp" className="h-full" />;
}
