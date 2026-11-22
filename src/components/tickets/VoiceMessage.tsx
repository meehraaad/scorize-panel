import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/IconButton';
import { acquireVoice, releaseVoice, useVoiceOwner } from '@/lib/voice/lease';
import { beginRecording, type Recording } from '@/lib/voice/recording';

export const voiceTime = (seconds: number) => {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

type Phase = 'idle' | 'opening' | 'recording' | 'finishing';

export function useVoiceMessage(onFile: (file: File, duration: number) => void) {
  const [key] = useState(() => Symbol('ticket-voice'));
  const owner = useVoiceOwner();
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const capture = useRef<Recording | undefined>(undefined);
  const started = useRef(0);
  useEffect(
    () => () => {
      request.current?.abort();
      releaseVoice(key);
    },
    [key],
  );

  const reset = () => {
    request.current = null;
    capture.current = undefined;
    releaseVoice(key);
    setPhase('idle');
  };
  const cancel = () => {
    request.current?.abort();
    reset();
  };
  const start = async () => {
    if (!acquireVoice(key)) return;
    const controller = new AbortController();
    request.current = controller;
    setPhase('opening');
    setSeconds(0);
    setError(false);
    try {
      const recording = await beginRecording({
        signal: controller.signal,
        stopOnSilence: false,
        onStart: () => {
          started.current = Date.now();
          setPhase('recording');
        },
        onTick: setSeconds,
        onFinish: (file) => {
          if (controller.signal.aborted) return;
          reset();
          if (file.size)
            onFile(file, Math.max(1, Math.round((Date.now() - started.current) / 1000)));
          else setError(true);
        },
        onError: () => {
          if (controller.signal.aborted) return;
          reset();
          setError(true);
        },
      });
      if (request.current === controller) capture.current = recording;
    } catch {
      if (controller.signal.aborted) return;
      reset();
      setError(true);
    }
  };
  const stop = () => {
    if (!capture.current) return;
    setPhase('finishing');
    capture.current.stop();
  };

  return {
    supported: typeof MediaRecorder !== 'undefined' && 'mediaDevices' in navigator,
    busy: owner !== null && owner !== key,
    phase,
    seconds,
    error,
    start,
    stop,
    cancel,
  };
}

let playingAudio: HTMLAudioElement | null = null;

export function VoicePlayer({
  src,
  label,
  duration: estimatedDuration = 0,
}: {
  src?: string | undefined;
  label: string;
  duration?: number;
}) {
  const { t } = useTranslation('tickets');
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(estimatedDuration);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    const node = audio.current;
    return () => {
      if (node && playingAudio === node) {
        playingAudio = null;
        node.pause();
      }
    };
  }, []);

  const update = (node: HTMLAudioElement) => {
    const seekable = node.seekable;
    const end = seekable.length ? seekable.end(seekable.length - 1) : 0;
    if (Number.isFinite(node.duration) && node.duration > 0) setDuration(node.duration);
    else if (Number.isFinite(end) && end > 0) setDuration(end);
    else if (node.ended && node.currentTime > 0) setDuration(node.currentTime);
    setPosition(node.currentTime);
  };
  const toggle = () => {
    const node = audio.current;
    if (!node) return;
    if (!node.paused) {
      node.pause();
      return;
    }
    setError(false);
    void node.play().catch((failure: unknown) => {
      if (!(failure instanceof DOMException && failure.name === 'AbortError')) setError(true);
    });
  };

  return (
    <div className="flex max-w-full min-w-0 flex-col">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        aria-label={label}
        onLoadedMetadata={(event) => update(event.currentTarget)}
        onDurationChange={(event) => update(event.currentTarget)}
        onProgress={(event) => update(event.currentTarget)}
        onTimeUpdate={(event) => update(event.currentTarget)}
        onPlay={(event) => {
          const node = event.currentTarget;
          if (playingAudio !== node) playingAudio?.pause();
          playingAudio = node;
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={(event) => {
          update(event.currentTarget);
          setPlaying(false);
        }}
        onError={() => setError(true)}
      />
      <div className="flex min-w-0 items-center gap-1 rounded-[22px] bg-tint ps-1 pe-3">
        <IconButton
          icon={playing ? 'pause' : 'play'}
          aria-label={playing ? t('voice.pause') : t('voice.startPlayback')}
          tone="primary"
          onClick={toggle}
        />
        <div className="flex min-w-0 flex-1 items-center gap-1.5" dir="ltr">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step="any"
            value={Math.min(position, duration)}
            disabled={!duration}
            aria-label={t('voice.seek')}
            aria-valuetext={voiceTime(position)}
            className="h-11 min-w-0 flex-1 accent-primary"
            onChange={(event) => {
              const node = audio.current;
              if (!node || node.readyState === 0) return;
              node.currentTime = event.currentTarget.valueAsNumber;
              setPosition(node.currentTime);
            }}
          />
          <span className="text-xs whitespace-nowrap text-text-2 tabular-nums">
            {voiceTime(position)}
            {duration > 0 && ` / ${voiceTime(duration)}`}
          </span>
        </div>
      </div>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {t('voice.playError')}
        </span>
      )}
    </div>
  );
}

export function AudioPreview({
  file,
  label,
  duration,
}: {
  file: File;
  label: string;
  duration?: number;
}) {
  const [src, setSrc] = useState<string>();
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    },
    [file],
  );

  return (
    <div ref={attach} className="min-w-0 flex-1">
      {src && (
        <VoicePlayer
          key={src}
          src={src}
          label={label}
          {...(duration === undefined ? {} : { duration })}
        />
      )}
    </div>
  );
}
