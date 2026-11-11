import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { VariableField, VariablePreview } from '@/components/ui/VariableField';
import { unknownVariables } from '@/lib/messageVariables';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  systemMessageQuery,
  useSaveSystemMessage,
  useTestSystemMessage,
  type SystemChange,
  type SystemMessage,
  type SystemMessageDetail,
} from '../api';
import { fieldError } from '../format';
import { History } from './History';

/** One automatic message: when and to whom it goes, on/off, its text, a test send, its history. */
export function SystemMessageDialog({
  message,
  onClose,
}: {
  message: SystemMessage;
  onClose: () => void;
}) {
  const { t } = useTranslation('messages');
  const { data } = useQuery({ ...systemMessageQuery(message.key), enabled: message.editable });
  return (
    <Dialog open onClose={onClose} title={message.title} closeLabel={t('close')}>
      {!message.editable ? (
        <About message={message} />
      ) : data ? (
        <MessageForm key={data.key} message={data} />
      ) : (
        <SkeletonRows rows={5} />
      )}
    </Dialog>
  );
}

/** When, to whom, through what, and what Kavenegar has sent of it. */
function About({ message }: { message: SystemMessage }) {
  const { t } = useTranslation('messages');
  const f = useFormat();
  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">
        <dt className="text-text-2">{t('detail.when')}</dt>
        <dd className="m-0">{message.when}</dd>
        <dt className="text-text-2">{t('detail.audience')}</dt>
        <dd className="m-0">{t(`audience.${message.audience}`)}</dd>
        <dt className="text-text-2">{t('detail.channels')}</dt>
        <dd className="m-0 flex flex-wrap gap-1.5">
          {message.channels.map((channel) => (
            <Chip key={channel} tone="neutral" small>
              {t(`channel.${channel}`)}
            </Chip>
          ))}
        </dd>
      </dl>
      {message.sms_template && (
        <Notice tone="info">
          {t('detail.smsTemplate', { template: message.sms_template })}
          {message.stats && (
            <>
              <br />
              {t('detail.stats', {
                sent: f.number(message.stats.sent),
                cost: f.number(message.stats.cost),
                when: f.timeAgo(message.stats.last_sent),
              })}
            </>
          )}
        </Notice>
      )}
      {!message.editable && <Notice tone="info">{t('detail.notEditable')}</Notice>}
    </div>
  );
}

function MessageForm({ message }: { message: SystemMessageDetail }) {
  const { t } = useTranslation('messages');
  const save = useSaveSystemMessage(message.key);
  const test = useTestSystemMessage(message.key);
  const [title, setTitle] = useState(message.title);
  const [text, setText] = useState(message.text);
  const [active, setActive] = useState(message.is_active);
  const [confirmTest, setConfirmTest] = useState(false);
  // The bell and Telegram show this text; an SMS-only message's text is just a copy of Kavenegar's.
  const writable = message.channels.some((channel) => channel === 'bell' || channel === 'telegram');
  const unknown = unknownVariables(text, message.variables);
  const textError =
    unknown === null
      ? t('detail.openBrace')
      : unknown.length > 0
        ? t('detail.unknown', { names: unknown.map((name) => `{${name}}`).join('، ') })
        : fieldError(save.error, 'text');

  const change: SystemChange = {};
  if (title.trim() !== message.title) change.title = title.trim();
  if (text !== message.text) change.text = text;
  if (active !== message.is_active) change.is_active = active;
  const changed = Object.keys(change).length > 0;

  const submit = (values: SystemChange, done: string) =>
    save.mutate(values, {
      onSuccess: (saved) => {
        setTitle(saved.title);
        setText(saved.text);
        setActive(saved.is_active);
        toast.success(done);
      },
      onError: () => toast.error(t('saveError')),
    });

  const sendTest = () =>
    test.mutate(undefined, {
      onSuccess: () => {
        setConfirmTest(false);
        toast.success(t('detail.testSent'));
      },
      onError: () => toast.error(t('detail.testError')),
    });

  return (
    <div className="flex flex-col gap-5">
      <About message={message} />
      <Switch
        label={t('detail.active')}
        description={active ? t('detail.activeOn') : t('detail.activeOff')}
        checked={active}
        onChange={setActive}
      />
      {writable ? (
        <>
          <TextField
            label={t('detail.title')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={128}
          />
          <VariableField
            label={t('detail.text')}
            hint={t('detail.textHint')}
            error={textError}
            value={text}
            onChange={setText}
            variables={message.variables}
            variablesLabel={t('detail.addVariable')}
          />
          <VariablePreview label={t('detail.preview')} text={text} variables={message.variables} />
        </>
      ) : (
        <VariablePreview label={t('detail.smsCopy')} text={text} variables={message.variables} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!changed || textError !== undefined || save.isPending}
          onClick={() => submit(change, t('detail.saved'))}
        >
          {t('detail.save')}
        </Button>
        {writable && message.edited && (
          <Button
            variant="outline"
            disabled={save.isPending}
            onClick={() => submit({ title: '', text: '' }, t('detail.resetDone'))}
          >
            {t('detail.reset')}
          </Button>
        )}
        {!confirmTest && (
          <Button
            variant="outline"
            disabled={!message.is_active || changed}
            onClick={() => (message.sms_template ? setConfirmTest(true) : sendTest())}
          >
            {t('detail.test')}
          </Button>
        )}
      </div>
      {changed && message.is_active && (
        <p className="m-0 text-sm text-text-2">{t('detail.testAfterSave')}</p>
      )}
      {confirmTest && (
        <InlineConfirm
          message={t('detail.testConfirm')}
          confirmLabel={t('detail.testButton')}
          cancelLabel={t('cancel')}
          pending={test.isPending}
          onCancel={() => setConfirmTest(false)}
          onConfirm={sendTest}
        />
      )}
      <History
        id={`system-${message.key}`}
        changes={message.history}
        onRestore={
          writable
            ? (version) => {
                setTitle(version.title);
                setText(version.text);
              }
            : undefined
        }
      />
    </div>
  );
}
