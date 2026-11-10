import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileDrop } from '@/components/ui/Files';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { phoneVoicesQuery, useUploadVoice, type PhoneVoice } from '@/lib/sales/phoneCalls';
import { UploadCancelled, UploadFailed } from '@/lib/upload';
import { useMenuName } from './phoneNames';

const TYPES = ['.mp3', '.wav', '.m4a', '.ogg', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'];
const EXTENSIONS = /\.(mp3|wav|m4a|ogg)$/i;
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * The greetings the office line's menus play (manager section). A new file goes to the PBX within
 * seconds: it is converted there, and the old greeting is kept as a backup.
 */
export default function PhoneVoicesPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(phoneVoicesQuery);

  return (
    <>
      <PageHeader
        title={t('manager.voices.title')}
        subtitle={
          data.seen_at
            ? t('manager.teams.seen', { time: f.dateTime(data.seen_at) })
            : t('manager.teams.notSeen')
        }
      />
      {data.voices.length === 0 ? (
        <SectionCard id="phone-voices-empty" variant="panel" title={t('manager.voices.title')}>
          <EmptyState>{t('manager.voices.empty')}</EmptyState>
        </SectionCard>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-7">
          {data.voices.map((voice) => (
            <VoiceCard key={voice.id} voice={voice} />
          ))}
        </div>
      )}
    </>
  );
}

function VoiceCard({ voice }: { voice: PhoneVoice }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const name = useMenuName();
  const upload = useUploadVoice(voice.id);
  const [problem, setProblem] = useState<string>();
  const inputId = `voice-${voice.id}-file`;
  const errorId = `voice-${voice.id}-error`;

  const pick = (file: File | undefined) => {
    setProblem(undefined);
    if (!file) return;
    if (!EXTENSIONS.test(file.name)) {
      setProblem(t('manager.voices.type'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setProblem(t('manager.voices.tooLarge'));
      return;
    }
    upload.mutate(
      {
        file,
        messages: {
          done: t('manager.voices.sent'),
          doneMeta: t('manager.voices.sentMeta'),
          retry: () => pick(file),
        },
      },
      {
        // The upload toast already says what went wrong.
        onError: (error) => {
          if (!(error instanceof UploadFailed || error instanceof UploadCancelled))
            setProblem(t('error'));
        },
      },
    );
  };

  const last = voice.last;
  const title = name(voice.name);
  return (
    <SectionCard
      id={`phone-voice-${voice.id}`}
      variant="panel"
      title={title}
      badge={
        <Chip
          small
          dot
          tone={
            last?.status === 'done'
              ? 'good'
              : last?.status === 'pending'
                ? 'info'
                : last?.status === 'failed'
                  ? 'danger'
                  : voice.menus.length === 0
                    ? 'warn'
                    : 'neutral'
          }
        >
          {t(
            `manager.voices.badge.${
              last?.status ?? (voice.menus.length === 0 ? 'unused' : 'voip')
            }`,
          )}
        </Chip>
      }
      subtitle={
        voice.menus.length > 0
          ? t('manager.voices.plays', { menus: f.list(voice.menus.map(name)) })
          : t('manager.voices.unused')
      }
    >
      <div className="flex flex-col gap-3">
        {last && (
          <p
            role="status"
            className={`m-0 text-[13px] ${last.status === 'failed' ? 'text-danger' : 'text-text-2'}`}
          >
            {last.status === 'pending' && t('manager.voices.pending')}
            {last.status === 'done' &&
              t('manager.voices.done', {
                time: f.dateTime(last.done_at ?? last.uploaded_at),
                name: last.by ?? t('manager.hours.someone'),
              })}
            {last.status === 'failed' && t('manager.voices.failed', { reason: last.error })}
          </p>
        )}
        <FileDrop
          id={inputId}
          accept={TYPES}
          compact
          disabled={upload.isPending}
          errorId={problem ? errorId : null}
          chooseLabel={t('manager.voices.choose')}
          hint={t('manager.voices.drop')}
          inputLabel={t('manager.voices.chooseFor', { name: title })}
          onFile={pick}
        />
        {problem && (
          <p id={errorId} role="alert" className="m-0 text-sm text-danger">
            {problem}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
