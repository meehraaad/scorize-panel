import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Composer } from '@/components/tickets/Composer';
import { ReadyReplies } from '@/components/tickets/ReadyReplies';
import { AudioPreview, useVoiceMessage, voiceTime } from '@/components/tickets/VoiceMessage';
import { IconButton } from '@/components/ui/IconButton';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { checkFile, extensionOf, type FileRule } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  ATTACHMENT_TYPES,
  AUDIO_ATTACHMENT_TYPES,
  DEFAULT_PRIORITY,
  MAX_ATTACHMENT_BYTES,
  PRIORITIES,
  URGENT,
  type Priority,
} from '@/lib/tickets/api';
import { useSendMessage } from '@/lib/tickets/mutations';
import { toast } from '@/lib/toast';
import type { TicketsConfig } from '@/lib/tickets/api';

/**
 * New message in the open thread. "Very urgent" needs its rules accepted first (as on the old site).
 * `compact`: in a narrow box (a chat window). `initialText` / `onTextChange`: the unsent text is
 * kept by the caller (a minimized chat keeps it).
 */
export function TicketComposer({
  config,
  thread,
  compact = false,
  initialText = '',
  onTextChange,
}: {
  config: TicketsConfig;
  thread: string;
  compact?: boolean;
  initialText?: string;
  onTextChange?: (text: string) => void;
}) {
  const { t } = useTranslation('tickets');
  const f = useFormat();
  const send = useSendMessage(config, thread);
  const [text, setTextState] = useState(initialText);
  const setText = (value: string) => {
    setTextState(value);
    onTextChange?.(value);
  };
  const [priority, setPriority] = useState<Priority>(DEFAULT_PRIORITY);
  const [accepted, setAccepted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [clip, setClip] = useState<{ file: File; duration: number } | null>(null);
  const attachmentTypes = ON_SERVER.ticketVoice
    ? [...ATTACHMENT_TYPES, ...AUDIO_ATTACHMENT_TYPES]
    : ATTACHMENT_TYPES;
  const rule: FileRule = { types: attachmentTypes, maxBytes: MAX_ATTACHMENT_BYTES };

  const applicant = config.viewer === 'applicant';
  const urgent = applicant && priority === URGENT;
  const canSend =
    (text.trim().length > 0 || (ON_SERVER.ticketVoice && file !== null)) && (!urgent || accepted);

  const validFile = (picked: File) => {
    // MediaRecorder includes a codec parameter; the server validates the actual container again.
    const problem = checkFile(
      new File([picked], picked.name, { type: picked.type.split(';')[0] ?? '' }),
      rule,
    );
    if (problem === 'badType')
      setFileError(t(ON_SERVER.ticketVoice ? 'voice.badType' : 'composer.badType'));
    else if (problem === 'tooBig')
      setFileError(
        t('composer.tooBig', {
          size: f.fileSize(picked.size),
          max: f.fileSize(MAX_ATTACHMENT_BYTES),
        }),
      );
    else setFileError(null);
    return !problem;
  };

  const pickAttachment = (picked: File | undefined) => {
    if (picked && validFile(picked)) setFile(picked);
  };
  const voice = useVoiceMessage((recorded, duration) => {
    if (!validFile(recorded)) return;
    setClip({ file: recorded, duration });
  });

  const submit = (voiceFile?: File) => {
    send.mutate(
      {
        text: voiceFile ? '' : text.trim(),
        priority: applicant ? priority : DEFAULT_PRIORITY,
        attachment: voiceFile ?? file,
      },
      {
        onError: () => toast.error(t('composer.sendError')),
        onSuccess: () => {
          if (voiceFile) setClip(null);
          else {
            setText('');
            setFile(null);
          }
          setPriority(DEFAULT_PRIORITY);
          setAccepted(false);
        },
      },
    );
  };

  if (voice.phase !== 'idle' || clip) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 bg-surface px-3 py-3 shadow-[inset_0_1px_0_var(--hair)]">
        <IconButton
          icon="trash"
          aria-label={t(clip ? 'voice.discard' : 'voice.cancel')}
          disabled={send.isPending}
          onClick={clip ? () => setClip(null) : voice.cancel}
        />
        {clip ? (
          <>
            <AudioPreview file={clip.file} duration={clip.duration} label={t('voice.preview')} />
            <IconButton
              icon="send"
              tone="primary"
              aria-label={t('composer.send')}
              aria-busy={send.isPending}
              disabled={send.isPending}
              onClick={() => submit(clip.file)}
            />
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-text-2">
              {voice.phase === 'recording' && (
                <span
                  aria-hidden="true"
                  className="size-2 flex-none rounded-full bg-danger motion-safe:animate-pulse"
                />
              )}
              <span role="status">
                {t(
                  voice.phase === 'opening'
                    ? 'voice.opening'
                    : voice.phase === 'finishing'
                      ? 'voice.finishing'
                      : 'voice.active',
                )}
              </span>
              {voice.phase === 'recording' && (
                <span dir="ltr" className="font-semibold text-text tabular-nums">
                  {voiceTime(voice.seconds)}
                </span>
              )}
            </div>
            <IconButton
              icon="stop"
              tone="danger"
              aria-label={t('voice.stop')}
              disabled={voice.phase !== 'recording'}
              onClick={voice.stop}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {!applicant && ON_SERVER.messageCenter && (
        <ReadyReplies
          customer={config.customer}
          caseId={config.caseId}
          onPick={(picked) => setText(text.trim() ? `${text.trimEnd()}\n${picked}` : picked)}
        />
      )}
      <Composer
        id={`ticket-${thread.replace('/', '-')}`}
        label={t('composer.label')}
        placeholder={t('composer.placeholder')}
        value={text}
        onChange={setText}
        emptyAction={
          ON_SERVER.ticketVoice &&
          voice.supported &&
          !text.trim() &&
          !file &&
          (!urgent || accepted) ? (
            <IconButton
              icon="microphone"
              tone="primary"
              aria-label={t('voice.record')}
              disabled={voice.busy || send.isPending}
              onClick={() => void voice.start()}
            />
          ) : null
        }
        accessory={
          voice.error ? (
            <p role="alert" className="m-0 text-sm text-danger">
              {t('voice.error')}
            </p>
          ) : file?.type.startsWith('audio/') ? (
            <AudioPreview file={file} label={t('voice.preview')} />
          ) : null
        }
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
          accept: attachmentTypes,
          file: file && {
            ext: extensionOf(file.name),
            name: file.name,
            meta: t('composer.ready', { size: f.fileSize(file.size) }),
          },
          removeLabel: t('composer.remove'),
          error: fileError,
          onFile: pickAttachment,
          onRemove: () => setFile(null),
        }}
        compact={compact}
        sendLabel={t('composer.send')}
        sending={send.isPending}
        canSend={canSend}
        onSubmit={() => submit()}
      />
    </>
  );
}
