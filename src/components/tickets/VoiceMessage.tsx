import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/IconButton';
import { MAX_ATTACHMENT_BYTES } from '@/lib/tickets/api';
import { voiceTime } from './useVoiceMessage';

const AUDIO_MIME: Readonly<Partial<Record<string, string>>> = {
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

/** Protected media may be served as a download. Keep the request on the authenticated origin. */
async function loadAudioDownload(src: string, fileName: string, signal: AbortSignal) {
  const url = new URL(src, window.location.href);
  const mime = AUDIO_MIME[fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()];
  if (!mime || url.origin !== window.location.origin) return;
  const response = await fetch(url, { mode: 'same-origin', redirect: 'error', signal });
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (
    !response.ok ||
    (contentType &&
      !contentType.startsWith('audio/') &&
      !['application/octet-stream', 'application/ogg', 'video/webm', 'video/mp4'].includes(
        contentType,
      )) ||
    Number(response.headers.get('content-length')) > MAX_ATTACHMENT_BYTES
  )
    return;
  const file = await response.blob();
  if (!file.size || file.size > MAX_ATTACHMENT_BYTES || signal.aborted) return;
  return URL.createObjectURL(new Blob([file], { type: mime }));
}

let playingAudio: HTMLAudioElement | null = null;

export function VoicePlayer({
  src,
  label,
  fileName,
  duration: estimatedDuration = 0,
}: {
  src?: string | undefined;
  label: string;
  fileName?: string;
  duration?: number;
}) {
  const { t } = useTranslation('tickets');
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(estimatedDuration);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const download = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | undefined>(undefined);
  useEffect(() => {
    const node = audio.current;
    return () => {
      download.current?.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
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
  const toggle = async () => {
    const node = audio.current;
    if (!node || download.current) return;
    if (!node.paused) {
      node.pause();
      return;
    }
    setError(false);
    try {
      await node.play();
      return;
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return;
      if (!src || !fileName || objectUrl.current || !node.error) {
        setError(true);
        return;
      }
    }
    const controller = new AbortController();
    download.current = controller;
    setLoading(true);
    try {
      const downloaded = await loadAudioDownload(src, fileName, controller.signal);
      if (!downloaded || controller.signal.aborted) {
        if (downloaded) URL.revokeObjectURL(downloaded);
        if (!controller.signal.aborted) setError(true);
        return;
      }
      objectUrl.current = downloaded;
      node.src = downloaded;
      await node.play();
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      download.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
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
        onError={() => {
          if (!fileName || objectUrl.current) setError(true);
        }}
      />
      <div className="flex min-w-0 items-center gap-1 rounded-[22px] bg-canvas ps-1 pe-3">
        <IconButton
          icon={playing ? 'pause' : 'play'}
          aria-label={playing ? t('voice.pause') : t('voice.startPlayback')}
          disabled={loading}
          aria-busy={loading}
          onClick={() => void toggle()}
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
            className="h-11 min-w-0 flex-1 accent-text"
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
