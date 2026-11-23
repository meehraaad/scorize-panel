import { useEffect, useRef, useState } from 'react';
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
