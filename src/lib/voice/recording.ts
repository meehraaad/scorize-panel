import { watchSilence } from './silence';
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS, type StopReason } from './types';

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];

export interface Recording {
  stop: (reason?: StopReason) => void;
}

/** Owns the microphone, timers and listeners; every exit closes all of them. */
export async function beginRecording({
  signal,
  onStart,
  onTick,
  onFinish,
  onError,
}: {
  signal: AbortSignal;
  onStart: () => void;
  onTick: (seconds: number) => void;
  onFinish: (file: File, reason: StopReason) => void;
  onError: () => void;
}): Promise<Recording | undefined> {
  const media = await navigator.mediaDevices.getUserMedia({ audio: true });
  if (signal.aborted) {
    media.getTracks().forEach((track) => track.stop());
    return;
  }
  const chunks: Blob[] = [];
  let recorder: MediaRecorder | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let silence: (() => void) | undefined;
  let reason: StopReason = 'manual';
  let stopped = false;
  let released = false;
  let bytes = 0;
  const started = Date.now();
  const release = () => {
    if (released) return;
    released = true;
    clearInterval(interval);
    clearTimeout(timeout);
    silence?.();
    signal.removeEventListener('abort', abort);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', abort);
    media.getTracks().forEach((track) => track.stop());
  };
  const stop = (why: StopReason = 'manual') => {
    if (stopped) return;
    stopped = true;
    reason = why;
    if (recorder?.state === 'recording') recorder.stop();
    // Don't wait for the final data/stop events to release microphone access.
    release();
  };
  const abort = () => stop();
  const visibility = () => {
    if (document.visibilityState === 'hidden') stop('hidden');
  };
  try {
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    recorder = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
    const current = recorder;
    recorder.ondataavailable = (event) => {
      chunks.push(event.data);
      bytes += event.data.size;
      if (bytes > MAX_VOICE_BYTES) stop('limit');
    };
    recorder.onerror = () => {
      stopped = true;
      release();
      if (!signal.aborted) onError();
      current.onstop = null;
      if (current.state === 'recording') current.stop();
    };
    recorder.onstop = () => {
      release();
      if (signal.aborted) return;
      const blob = new Blob(chunks, { type: current.mimeType });
      const extension = current.mimeType.includes('mp4')
        ? 'mp4'
        : current.mimeType.includes('ogg')
          ? 'ogg'
          : 'webm';
      onFinish(new File([blob], `voice.${extension}`, { type: blob.type }), reason);
    };
    signal.addEventListener('abort', abort, { once: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', abort);
    recorder.start(1000);
    onStart();
    interval = setInterval(() => onTick(Math.floor((Date.now() - started) / 1000)), 1000);
    timeout = setTimeout(() => stop('limit'), (MAX_VOICE_SECONDS - 1) * 1000);
    silence = watchSilence(media, () => stop('silence'));
    if (document.visibilityState === 'hidden') stop('hidden');
    return { stop };
  } catch (error) {
    release();
    throw error;
  }
}
