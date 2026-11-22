import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/IconButton';
import { voiceTime } from './useVoiceMessage';

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
