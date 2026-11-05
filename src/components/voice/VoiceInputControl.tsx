import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { useFormat } from '@/lib/i18n/useFormat';
import { MAX_VOICE_SECONDS } from '@/lib/voice/types';
import type { useVoiceInput } from '@/lib/voice/useVoiceInput';

export type VoiceInput = ReturnType<typeof useVoiceInput>;

export function VoiceInputControl({
  voice,
  recovery,
  variant = 'full',
}: {
  voice: VoiceInput;
  recovery: boolean;
  variant?: 'full' | 'button' | 'status';
}) {
  const { t } = useTranslation('voice');
  const format = useFormat();
  const inputId = useId();
  const { phase, seconds } = voice;
  const recording = phase === 'recording';
  const pending = phase === 'processing' || phase === 'opening';
  const active = recording || pending;
  const canRecord = typeof MediaRecorder !== 'undefined' && 'mediaDevices' in navigator;
  const remaining = Math.max(0, MAX_VOICE_SECONDS - seconds);
  const time = format.digits(
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
  );
  const action = recording ? t('stop') : phase === 'done' ? t('recordMore') : t('record');
  const status = recording
    ? remaining <= 15
      ? t('endingSoon', { seconds: format.digits(String(remaining)) })
      : t('recording')
    : phase === 'processing'
      ? voice.stopReason === 'manual'
        ? t('processing')
        : t(`autoStop.${voice.stopReason}`)
      : phase === 'opening'
        ? t('opening')
        : phase === 'done' && !recovery
          ? t('done')
          : t('idle');
  const main = canRecord && (
    <IconButton
      icon={recording ? 'stop' : pending ? 'clock' : 'microphone'}
      tone="inherit"
      aria-label={action}
      title={voice.blocked ? t('anotherField') : action}
      aria-description={voice.blocked ? t('anotherField') : t('safetyHint')}
      aria-pressed={recording}
      aria-busy={pending}
      disabled={pending || voice.blocked || recovery}
      onClick={() => (recording ? voice.stop() : void voice.start())}
      className={
        recording
          ? 'bg-danger text-surface shadow-sm hover:bg-danger'
          : 'bg-tint text-primary-text hover:bg-primary hover:text-on-primary'
      }
    />
  );
  if (variant === 'button') return main;
  return (
    <div
      className={`flex min-h-11 items-center gap-2 rounded-xl ${recording ? 'bg-danger-tint' : 'bg-surface/95'} ${variant === 'full' ? 'flex-row-reverse rtl:flex-row' : ''}`}
    >
      {variant === 'full' && main}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        {recording && (
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full bg-danger motion-safe:animate-pulse"
          />
        )}
        {phase === 'done' && !recovery && (
          <Icon name="check" size={16} className="shrink-0 text-good" />
        )}
        <span
          role="status"
          className={`truncate text-xs ${recording ? 'text-danger' : phase === 'done' ? 'text-good' : 'text-text-3'}`}
        >
          {status}
        </span>
        {recording && (
          <span
            className="shrink-0 text-xs font-semibold text-danger tabular-nums"
            dir="ltr"
            aria-label={t('elapsed', { time })}
          >
            {time}
          </span>
        )}
      </div>
      {active ? (
        <IconButton
          icon="close"
          tone="muted"
          aria-label={t('cancel')}
          title={t('cancel')}
          onClick={voice.cancel}
        />
      ) : (
        <>
          <input
            id={inputId}
            aria-label={t('upload')}
            type="file"
            accept="audio/*,.webm,.mp4,.m4a,.ogg,.mp3,.wav"
            className="sr-only"
            disabled={voice.blocked || recovery}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) voice.send(file);
            }}
          />
          <IconButton
            icon="upload"
            tone="muted"
            aria-label={t('upload')}
            title={t('upload')}
            disabled={voice.blocked || recovery}
            onClick={() => document.getElementById(inputId)?.click()}
          />
        </>
      )}
    </div>
  );
}
