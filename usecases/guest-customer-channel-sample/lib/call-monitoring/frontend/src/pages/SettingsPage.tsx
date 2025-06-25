import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotStore } from '@/stores/BotStore';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { useForm, SubmitHandler } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ConfirmationButton from '@/components/ConfirmationButton';
import { Bot } from '@/graphql/generated';
import { Clipboard, ClipboardCheck, PlusCircle } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

// const TRANSCRIPT_TAG = `<transcript></transcript> に発言内容が配列形式で時系列に記録されています。
// 配列中の各要素は JSON で、中身の "transcript" は会話の発言内容を示しています。 "participantRole" は発言者の属性です。participantRole が同じ場合、同一話者の発言です。AGENT はオペレータ、CUSTOMER は顧客を示します。`;

const SAMPLE_CHECKLIST = `1. 顧客の名前を確認したか。（例: お名前を頂戴できますか。お名前をお聞かせいただけますか。）
2. コンタクトセンター名に加えて自身の名乗りを行った。（例: 担当の田中です、など自身の名前を名乗った。）
3. 不適切な言葉遣いを使用した。（例：顧客に対し「お前」「貴様」などの敬語を欠いた呼称を使った。個人攻撃や侮辱的な発言を行った。）
1は必須事項、2は推奨事項、3は違反事項です。
`;

function SettingsPage() {
  const { t } = useTranslation();

  const { state, addBot, deleteBot, getBots } = useContext(BotStore);

  const [selected, setSelected] = useState<Bot | null>(null);
  const [activeBot, setActiveBot] = useState<Bot | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSelectedBotActive, setIsSelectedBotActive] = useState(false);
  const { register, handleSubmit, reset, getValues } = useForm<Bot>();

  const DEFAULT_VALUE = {
    botName: '',
    botDescription: '',
    botContents: '',
    active: false,
  };

  useEffect(() => {
    if (getBots) {
      getBots();
    }
  }, []);

  useEffect(() => {
    if (state.bots.length > 0) {
      const activeBot = state.bots.find((bot) => bot.active);
      setActiveBot(activeBot ?? null);
    }
  }, [state.bots]);

  const onBotChangeActive = (bot: Bot) => {
    const editedBot = {
      botId: bot.botId,
      botName: bot.botName,
      botDescription: bot.botDescription,
      botContents: bot.botContents,
      active: bot.active ? false : true,
    };
    addBot(editedBot);
  };

  const onCopied = () => {
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 3000);
  };

  const onCreate = () => {
    setSelected(null);
    reset({ ...DEFAULT_VALUE });
    setIsSelectedBotActive(false);
    setIsEditing(true);
  };

  const onEdit = () => {
    reset({ ...selected });
    setIsSelectedBotActive(selected!.active);
    setIsEditing(true);
  };

  const onDelete = () => {
    if (!selected) {
      return;
    }
    deleteBot(selected.botId);
    setSelected(null);
    setIsEditing(false);
  };

  const onCancel = () => {
    reset();
    setIsSelectedBotActive(false);
    setIsEditing(false);
  };

  const onSubmit: SubmitHandler<Bot> = (data) => {
    const editedBot: Partial<Bot> = {
      botName: data.botName,
      botDescription: data.botDescription,
      botContents: data.botContents,
      active: isSelectedBotActive,
    };
    if (data.botId) {
      editedBot.botId = data.botId;
    }
    addBot(editedBot);
    setIsEditing(false);
  };

  return (
    <>
      <div className="mx-8 flex flex-1 flex-col">
        <div className="my-2 flex flex-1 items-start space-x-4">
          <Card className="w-80">
            <CardHeader>
              <CardTitle className="text-xl">{t('SETTINGS_PAGE.LABEL_BOT_SETTINGS')}</CardTitle>
              <CardDescription>{t('SETTINGS_PAGE.DESCRIPTION_BOT_SETTINGS')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" className="self-start" onClick={onCreate}>
                <PlusCircle className="mr-2 size-4" /> {t('SETTINGS_PAGE.BUTTON_CREATE_BOT')}
              </Button>
              {state.loading && <div className="text-muted-foreground">{t('SETTINGS_PAGE.TEXT_LOADING')}</div>}
              {!state.loading &&
                state.bots.map((bot) => (
                  <div
                    key={bot.botId}
                    onClick={() => {
                      if (isEditing) {
                        if (selected && selected.botId !== bot.botId) {
                          alert(t('SETTINGS_PAGE.ALERT_EDIT_FIRST'));
                        }
                        return;
                      }
                      setSelected(bot);
                    }}
                    className={twMerge(
                      'flex flex-col gap-3 items-start rounded-lg border p-4 text-left transition-all hover:bg-accent',
                      selected && selected.botId === bot.botId && 'bg-accent',
                    )}
                  >
                    <div className="flex w-full flex-col gap-1">
                      <div
                        className={twMerge(
                          'text-sm flex items-center gap-2 text-muted-foreground',
                          bot.active && 'text-emerald-500',
                        )}
                      >
                        <span
                          className={twMerge(
                            'inline-block w-3 h-3 rounded-full bg-slate-400',
                            bot.active && 'bg-emerald-500',
                          )}
                        >
                          &nbsp;
                        </span>
                        {bot.active ? t('SETTINGS_PAGE.LABEL_ENABLED') : t('SETTINGS_PAGE.LABEL_DISABLED')}
                      </div>
                      <div className="font-semibold">{bot.botName}</div>
                      <div className="text-muted-foreground text-sm">{bot.botDescription}</div>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {t('SETTINGS_PAGE.LABEL_MODIFIED')} {new Date(bot.modifiedAt).toLocaleString()}
                    </div>
                    {(!activeBot || activeBot.botId === bot.botId) && (
                      <ConfirmationButton
                        description={
                          bot.active ? t('SETTINGS_PAGE.CONFIRMATION_DISABLE') : t('SETTINGS_PAGE.CONFIRMATION_ENABLE')
                        }
                        onSubmit={() => {
                          onBotChangeActive(bot);
                        }}
                      >
                        {bot.active ? t('SETTINGS_PAGE.BUTTON_DISABLE') : t('SETTINGS_PAGE.BUTTON_ENABLE')}
                      </ConfirmationButton>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
          <div className="flex-1 space-y-2">
            {!selected && !isEditing && (
              <div className="text-muted-foreground grid min-h-64 w-full place-content-center px-8 text-lg">
                <span>{t('SETTINGS_PAGE.TEXT_NO_SELECTED_BOT')}</span>
              </div>
            )}
            {selected && !isEditing && (
              <Card className="px-8">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-xl">{selected.botName}</CardTitle>
                    <CardDescription>{selected.botDescription}</CardDescription>
                  </div>
                  <ConfirmationButton
                    variant="destructive"
                    description={t('SETTINGS_PAGE.CONFIRMATION_DELETE')}
                    onSubmit={onDelete}
                  >
                    {t('SETTINGS_PAGE.BUTTON_DELETE')}
                  </ConfirmationButton>
                  <Button variant="outline" onClick={onEdit}>
                    {t('SETTINGS_PAGE.BUTTON_EDIT')}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-lg font-semibold">{t('SETTINGS_PAGE.LABEL_CHECK_LIST')}</p>
                  <pre className="whitespace-pre-wrap break-words text-sm">{selected.botContents}</pre>
                </CardContent>
              </Card>
            )}
            {isEditing && (
              <Card className="px-8">
                <form id="bot-form" onSubmit={handleSubmit(onSubmit)}>
                  <CardHeader className="flex flex-row">
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-xl">
                        {getValues('botId') ? t('SETTINGS_PAGE.LABEL_EDIT') : t('SETTINGS_PAGE.LABEL_CREATE')}
                      </CardTitle>
                      <CardDescription>
                        {getValues('botId')
                          ? t('SETTINGS_PAGE.DESCRIPTION_EDIT')
                          : t('SETTINGS_PAGE.DESCRIPTION_CREATE')}
                      </CardDescription>
                    </div>
                    {getValues('botId') && (
                      <div className="flex items-start justify-center gap-2">
                        <div
                          className={twMerge(
                            'flex items-center gap-2 text-muted-foreground',
                            isSelectedBotActive && 'text-emerald-500',
                          )}
                        >
                          <span
                            className={twMerge(
                              'inline-block w-3 h-3 rounded-full bg-slate-400',
                              isSelectedBotActive && 'bg-emerald-500',
                            )}
                          >
                            &nbsp;
                          </span>
                          {isSelectedBotActive ? t('SETTINGS_PAGE.TEXT_ENABLED') : t('SETTINGS_PAGE.TEXT_DISABLED')}
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="bot-name-input" className="font-semibold">
                        {t('SETTINGS_PAGE.LABEL_BOT_NAME')}
                      </label>
                      <Input
                        id="bot-name-input"
                        className="w-full"
                        {...register('botName', { required: true })}
                        required
                      ></Input>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="bot-description-input" className="font-semibold">
                        {t('SETTINGS_PAGE.LABEL_BOT_DESCRIPTION')}
                      </label>
                      <Input id="bot-description-input" className="w-full" {...register('botDescription')}></Input>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="bot-prompt-textarea" className="font-semibold">
                        {t('SETTINGS_PAGE.LABEL_CHECK_LIST')}
                      </label>
                      <div className="text-muted-foreground space-y-2 text-sm">
                        <p>{t('SETTINGS_PAGE.DESCRIPTION_CHECK_LIST')}</p>
                        <div className="flex border">
                          <pre className="flex-1 whitespace-pre-wrap break-words p-4 text-slate-700">
                            {SAMPLE_CHECKLIST}
                          </pre>
                          <Button variant="ghost" type="button" className="m-2 size-10 p-1">
                            <CopyToClipboard text={SAMPLE_CHECKLIST} onCopy={onCopied}>
                              {isCopied ? <ClipboardCheck className="size-5" /> : <Clipboard className="size-5" />}
                            </CopyToClipboard>
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        id="bot-prompt-textarea"
                        className="h-96 w-full"
                        placeholder={t('SETTINGS_PAGE.PLACEHOLDER_CHECK_LIST')}
                        {...register('botContents', { required: true })}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    {getValues('botId') && (
                      <ConfirmationButton
                        variant="destructive"
                        description={t('SETTINGS_PAGE.CONFIRMATION_DELETE')}
                        onSubmit={onDelete}
                      >
                        {t('SETTINGS_PAGE.BUTTON_DELETE')}
                      </ConfirmationButton>
                    )}
                    <div className="flex flex-1 justify-end gap-2">
                      <Button type="button" variant="outline" onClick={onCancel}>
                        {t('COMMON.BUTTON_CANCEL')}
                      </Button>
                      <Button type="submit">{t('SETTINGS_PAGE.BUTTON_SAVE')}</Button>
                    </div>
                  </CardFooter>
                </form>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
export default SettingsPage;
