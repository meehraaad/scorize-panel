import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/IconButton';
import { useFormat } from '@/lib/i18n/useFormat';
import { acquireVoice, releaseVoice, useVoiceOwner } from '@/lib/voice/lease';
import { beginRecording, type Recording } from '@/lib/voice/recording';

export function AudioPreview({ file, label }: { file: File; label: string }) {
  const attach = useCallback(
    (node: HTMLAudioElement | null) => {
      if (!node) return;
      const url = URL.createObjectURL(file);
      node.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [file],
  );
  return (
    <audio
      ref={attach}
      controls
      preload="metadata"
      aria-label={label}
      className="h-11 w-full max-w-full"
    />
  );
}

export function VoiceMessage({
  disabled,
  onFile,
  onActive,
}: {
  disabled: boolean;
  onFile: (file: File) => void;
  onActive: (active: boolean) => void;
}) {
  const { t } = useTranslation('tickets');
  const format = useFormat();
  const [key] = useState(() => Symbol('ticket-voice'));
  const owner = useVoiceOwner();
  const [phase, setPhase] = useState<'idle' | 'opening' | 'recording'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const capture = useRef<Recording | undefined>(undefined);
  useEffect(
    () => () => {
      request.current?.abort();
      releaseVoice(key);
    },
    [key],
  );
  const cancel = () => {
    request.current?.abort();
    releaseVoice(key);
    setPhase('idle');
    onActive(false);
  };
  const start = async () => {
    if (disabled || !acquireVoice(key)) return;
    const controller = new AbortController();
    request.current = controller;
    setPhase('opening');
    setSeconds(0);
    setError(false);
    onActive(true);
    try {
      capture.current = await beginRecording({
        signal: controller.signal,
        onStart: () => setPhase('recording'),
        onTick: setSeconds,
        onFinish: (file) => {
          if (controller.signal.aborted) return;
          releaseVoice(key);
          setPhase('idle');
          onActive(false);
          if (file.size) onFile(file);
        },
        onError: () => {
          releaseVoice(key);
          setPhase('idle');
          setError(true);
          onActive(false);
        },
      });
    } catch {
      if (!controller.signal.aborted) {
        setError(true);
        setPhase('idle');
        releaseVoice(key);
        onActive(false);
      }
    }
  };
  const supported = typeof MediaRecorder !== 'undefined' && 'mediaDevices' in navigator;
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-text-2">
      {supported && (
        <IconButton
          icon={phase === 'recording' ? 'stop' : 'microphone'}
          aria-label={t(phase === 'recording' ? 'voice.stop' : 'voice.record')}
          aria-pressed={phase === 'recording'}
          tone={phase === 'recording' ? 'danger' : 'default'}
          disabled={disabled || phase === 'opening' || (owner !== null && owner !== key)}
          onClick={() => (phase === 'recording' ? capture.current?.stop() : void start())}
        />
      )}
      <span role="status">
        {t(
          error
            ? 'voice.error'
            : !supported
              ? 'voice.unsupported'
              : phase === 'recording'
                ? 'voice.recording'
                : phase === 'opening'
                  ? 'voice.opening'
                  : 'voice.hint',
          { seconds: format.number(seconds) },
        )}
      </span>
      {phase !== 'idle' && (
        <IconButton icon="close" aria-label={t('voice.cancel')} onClick={cancel} />
      )}
    </div>
  );
}
