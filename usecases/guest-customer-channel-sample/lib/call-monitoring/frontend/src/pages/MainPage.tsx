import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectContext } from '@/providers/ConnectProvider';
import { ContactStore } from '@/stores/ContactStore';
import { ContactDetailStore } from '@/stores/ContactDetailStore';
import { Button } from '@/components/ui/button';
import ContactIdsCommand from '@/components/ContactIdsCommand';
import { ChevronDown, CircleCheck, Loader, Siren } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

function MainPage() {
  const { t } = useTranslation();
  const { contactId, setContactId, originalContactId, currentContactId, agentState, agentId, agentName, initialized } =
    useContext(ConnectContext);
  const { state: contactSummaryState, loadAssigns } = useContext(ContactStore);
  const { state, loadContact, checkTranscript, clear } = useContext(ContactDetailStore);
  const [inputValue, setInputValue] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // agentId が変更されたら、Contact 一覧を取得
  useEffect(() => {
    if (agentId) {
      loadAssigns(agentId);
    }
  }, [agentId]);

  // contactId が変更されたら、既存のデータを取得
  useEffect(() => {
    if (contactId) {
      clear();
      loadContact(contactId);
    }
    setIsHistoryOpen(!contactId);
  }, [contactId]);

  // ライブ文字起こしエリアのスクロール位置を最下部に設定
  useEffect(() => {
    if (state.transcripts.length > 0) {
      const element = scrollRef.current!;
      const elementHeight = element.scrollHeight;
      element.scrollTop = elementHeight;
    }
  }, [state.transcripts]);

  const onCheckTranscript = () => {
    // （デバッグ用）ボタンクリック時にチェック処理を実行
    checkTranscript(contactId);
  };

  const onMonitorStart = () => {
    if (inputValue) {
      setContactId(inputValue);
    }
  };

  const onChangeContactId = () => {
    if (contactId === originalContactId) {
      setContactId(currentContactId);
    } else {
      setContactId(originalContactId);
    }
  };

  const onGetCallLog = (id: string) => {
    setContactId(id);
  };

  const onClear = () => {
    setInputValue('');
    setContactId('');
    clear();
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
  };

  return (
    <>
      <div className="mx-8 flex flex-1 flex-col pb-4">
        <div className="my-2 flex items-center space-x-2">
          <label className="whitespace-nowrap text-sm font-semibold text-slate-500" htmlFor="contact-id">
            {t('MAIN_PAGE.LABEL_CONTACT_ID')}
          </label>
          {contactId && (
            <>
              <div className="flex max-w-[340px] items-center text-sm font-semibold md:max-w-[440px]">
                <p className="flex-1 truncate p-2">{contactId}</p>
                {originalContactId && contactId === originalContactId && (
                  <p className="whitespace-nowrap">{t('MAIN_PAGE.TEXT_ORIGINAL')}</p>
                )}
              </div>
              {originalContactId && (
                <Button variant="outline" onClick={onChangeContactId} disabled={state.loading}>
                  {contactId === originalContactId ? t('MAIN_PAGE.BUTTON_CURRENT') : t('MAIN_PAGE.BUTTON_ORIGINAL')}
                </Button>
              )}
            </>
          )}
          {!contactId && (
            <ContactIdsCommand
              id="contact-id"
              assigns={contactSummaryState.assigns}
              loading={contactSummaryState.loading}
              onChange={setInputValue}
              className="w-[240px] md:w-[340px]"
            />
          )}
          {!contactId && <Button onClick={onMonitorStart}>{t('MAIN_PAGE.BUTTON_START_MONITOR')}</Button>}
          {contactId && <Button onClick={onClear}>{t('MAIN_PAGE.BUTTON_CLEAR')}</Button>}
        </div>
        <div className="flex flex-1 space-x-4">
          <div className="flex-1">
            <div
              className="max-h-[calc(100vh-129px)] space-y-4 overflow-y-auto rounded-xl border px-8 py-4 shadow"
              ref={scrollRef}
            >
              <div className="space-y-2">
                <h3 className="font-semibold">{t('MAIN_PAGE.LABEL_CONNECT_STATE')}</h3>
                {!initialized && <p className="text-sm text-red-700">{t('MAIN_PAGE.TEXT_NO_AGENT')}</p>}
                <p className="text-sm">
                  {t('MAIN_PAGE.LABEL_AGENT_NAME')} {agentName || t('MAIN_PAGE.TEXT_NO_AGENT_NAME')}
                </p>
                <p className="text-sm">
                  {t('MAIN_PAGE.LABEL_AGENT_STATE')} {agentState?.state ?? t('MAIN_PAGE.TEXT_NO_AGENT_STATE')}
                </p>
              </div>
              <div className="border-t pt-4">
                <h3 className="mb-6 font-semibold">{t('MAIN_PAGE.LABEL_TRANSCRIPT')}</h3>
                {state.calling && contactId && (
                  <div className="flex items-center space-x-2 text-sm text-slate-500">
                    <span>{t('MAIN_PAGE.TEXT_TRANSCRIPTION_IN_PROGRESS')}</span>
                    <Loader className="size-4 animate-spin" />
                  </div>
                )}
                {!contactId && <p className="text-sm text-slate-500">{t('MAIN_PAGE.TEXT_NO_TRANSCRIPT')}</p>}
                {state.transcripts.map((transcript, index) => {
                  return (
                    <div
                      key={index}
                      className={twMerge(
                        'flex-1 flex justify-start text-sm',
                        transcript.participantRole === 'AGENT' && 'justify-end',
                      )}
                    >
                      <div className="relative my-2 flex max-w-96 flex-col items-end">
                        <div
                          className={twMerge(
                            'rounded-md p-2 bg-sky-200',
                            transcript.participantRole === 'AGENT' && 'bg-green-200',
                          )}
                        >
                          <div className="text-sm text-slate-500">
                            {transcript.participantRole === 'AGENT' && agentName
                              ? agentName
                              : transcript.participantRole}
                          </div>
                          <div>{transcript.transcript}</div>
                        </div>
                        <span className="text-slate-400">{formatTime(transcript.begin)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="relative flex-1 space-y-4">
            {contactId && (
              <div className="bg-card text-card-foreground space-y-4 rounded-xl border px-8 py-4 shadow">
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="mb-6 font-semibold">{t('MAIN_PAGE.LABEL_CHECK')}</h3>
                    <Button onClick={onCheckTranscript} disabled={!contactId || state.checking} className="space-x-2">
                      {!state.checking && t('MAIN_PAGE.BUTTON_CHECK')}
                      {state.checking && (
                        <>
                          <span>{t('MAIN_PAGE.BUTTON_CHECKING')}</span>
                          <Loader className="size-4 animate-spin" />
                        </>
                      )}
                    </Button>
                  </div>
                  {state.checkResult && (
                    <div className="space-y-2">
                      {state.checkResult.map((item, index) => {
                        return (
                          <div key={index}>
                            {/* answer の場合は文字列による回答のみを表示する */}
                            {item.answer && (
                              <div className="space-y-4 rounded-md border p-4">
                                <p className="font-semibold">{item.label}</p>
                                <div className="text-sm">{item.answer}</div>
                              </div>
                            )}
                            {/* 確認事項はオブジェクトの label と confirmed を表示する */}
                            {!item.answer && item.importance != 'alert' && (
                              <div
                                className={twMerge(
                                  'flex w-2/3 space-between items-center rounded-md border border-l-4 px-4 py-2 text-sm',
                                  item.confirmed === true
                                    ? 'border-l-green-500'
                                    : item.importance == 'high'
                                    ? 'border-l-red-500 text-red-500'
                                    : 'border-l-orange-500 text-orange-500',
                                )}
                              >
                                <span className="flex-1">{item.label}</span>
                                <span>
                                  {item.confirmed === true && <CircleCheck className="size-6 text-green-500" />}
                                </span>
                              </div>
                            )}
                            {/* 違反事項は抵触した場合にオブジェクトの label を表示する */}
                            {!item.answer && item.importance == 'alert' && item.confirmed == true && (
                              <div
                                className={twMerge(
                                  'flex w-2/3 space-x-4 items-center rounded-md p-1 text-sm font-semibold text-red-500',
                                )}
                              >
                                <span>{item.confirmed === true && <Siren className="size-5 text-red-500" />}</span>
                                <span className="flex-1">{item.label}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!state.checkResult && <p className="text-sm text-slate-500">{t('MAIN_PAGE.TEXT_NO_RESULT')}</p>}
                  {state.checkResultError && <p className="text-sm text-red-500">{state.checkResultError.message}</p>}
                </div>
                <div className="border-t pt-4">
                  <h3 className="mb-2 font-semibold">{t('MAIN_PAGE.LABEL_SUMMARY')}</h3>
                  <p className="mb-6 text-sm text-slate-500">{t('MAIN_PAGE.DESCRIPTION_SUMMARY')}</p>
                  {!state.summary && <p className="text-sm text-slate-500">{t('MAIN_PAGE.TEXT_NO_SUMMARY')}</p>}
                  <div>
                    <pre className="whitespace-pre-wrap break-words text-sm">{state.summary}</pre>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-card text-card-foreground w-full space-y-2 overflow-hidden rounded-xl border px-8 py-4 shadow transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-semibold">{t('MAIN_PAGE.LABEL_CALL_HISTORY')}</h3>
                    {contactSummaryState.loading && <Loader className="size-4 animate-spin" />}
                  </div>
                  <Button
                    onClick={() => {
                      setIsHistoryOpen(!isHistoryOpen);
                    }}
                    variant="ghost"
                  >
                    <ChevronDown className={twMerge('w-5 h-5', isHistoryOpen && 'rotate-180')} />
                  </Button>
                </div>
                <div className={twMerge('transition-all', !isHistoryOpen && 'h-0 opacity-0 invisible')}>
                  <p className="text-sm text-slate-500">{t('MAIN_PAGE.DESCRIPTION_CALL_HISTORY')}</p>
                  <div className={twMerge('space-y-8', isHistoryOpen && 'mt-6')}>
                    {contactSummaryState.assigns.length == 0 && (
                      <div className="text-muted-foreground text-sm">{t('MAIN_PAGE.TEXT_NO_HISTORY')}</div>
                    )}
                    {contactSummaryState.assigns.map((assign) => {
                      return (
                        <div key={assign.contactId} className="flex items-center gap-1">
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {new Date(assign.startDate).toLocaleString()}
                              {assign.endDate && ` - ${new Date(assign.endDate).toLocaleTimeString()}`}
                            </p>
                            <p className="text-muted-foreground text-sm">{assign.contactId}</p>
                          </div>
                          <div className="ml-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onGetCallLog(assign.contactId);
                              }}
                            >
                              {t('MAIN_PAGE.BUTTON_CALL_LOG')}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default MainPage;
