import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Composer } from '@/components/tickets/Composer';
import { checkFile, extensionOf, type FileRule } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  ATTACHMENT_TYPES,
  DEFAULT_PRIORITY,
  MAX_ATTACHMENT_BYTES,
  PRIORITIES,
  URGENT,
  useSendMessage,
  type Priority,
} from '@/lib/tickets/api';
import { toast } from '@/lib/toast';
import type { TicketsConfig } from '../config';

const RULE: FileRule = { types: ATTACHMENT_TYPES, maxBytes: MAX_ATTACHMENT_BYTES };

/** New message in the open thread. "Very urgent" needs its rules accepted first (as on the old site). */
export function TicketComposer({ config, thread }: { config: TicketsConfig; thread: string }) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const send = useSendMessage(config, thread);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<Priority>(DEFAULT_PRIORITY);
  const [accepted, setAccepted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const applicant = config.viewer === 'applicant';
  const urgent = applicant && priority === URGENT;
  const canSend = text.trim().length > 0 && (!urgent || accepted);

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    const problem = checkFile(picked, RULE);
    if (problem === 'badType') setFileError(t('composer.badType'));
    else if (problem === 'tooBig')
      setFileError(
        t('composer.tooBig', {
          size: f.fileSize(picked.size),
          max: f.fileSize(MAX_ATTACHMENT_BYTES),
        }),
      );
    else setFileError(null);
    setFile(problem ? null : picked);
  };

  const submit = () => {
    send.mutate(
      { text: text.trim(), priority: applicant ? priority : DEFAULT_PRIORITY, attachment: file },
      {
        onError: () => toast.error(t('composer.sendError')),
        onSuccess: () => {
          setText('');
          setFile(null);
          setPriority(DEFAULT_PRIORITY);
          setAccepted(false);
        },
      },
    );
  };

  return (
    <Composer
      id={`ticket-${thread.replace('/', '-')}`}
      label={t('composer.label')}
      placeholder={t('composer.placeholder')}
      value={text}
      onChange={setText}
      priority={
        applicant
          ? {
              label: t('composer.priority'),
              options: PRIORITIES.map((value) => ({
                value,
                label: t(`priority.${value}`),
                tone: value === URGENT ? 'warn' : undefined,
              })),
              value: priority,
              onChange: (value) =>
                setPriority(PRIORITIES.find((item) => item === value) ?? DEFAULT_PRIORITY),
            }
          : undefined
      }
      confirm={
        urgent
          ? {
              text: <Trans t={t} i18nKey="composer.urgentRules" components={{ b: <b /> }} />,
              label: t('composer.accept'),
              checked: accepted,
              onChange: setAccepted,
            }
          : null
      }
      attach={{
        label: t('composer.attach'),
        accept: ATTACHMENT_TYPES,
        file: file && {
          ext: extensionOf(file.name),
          name: file.name,
          meta: t('composer.ready', { size: f.fileSize(file.size) }),
        },
        removeLabel: t('composer.remove'),
        error: fileError,
        onFile: pick,
        onRemove: () => setFile(null),
      }}
      sendLabel={t('composer.send')}
      sending={send.isPending}
      canSend={canSend}
      onSubmit={submit}
    />
  );
}
