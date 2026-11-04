import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { beginRecording, type Recording } from './recording';
import { acquireVoice, releaseVoice, useVoiceOwner } from './lease';
import {
  MAX_VOICE_BYTES,
  type StopReason,
  type Transcribe,
  type VoiceError,
  type VoicePhase,
} from './types';

export function useVoiceInput(
  transcribe: Transcribe,
  onText: (text: string) => boolean,
  enabled: boolean,
) {
  const [currentPhase, setPhase] = useState<VoicePhase>('idle');
  const [error, setError] = useState<VoiceError | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [stopReason, setStopReason] = useState<StopReason>('manual');
  const [key] = useState(() => Symbol('voice'));
  const owner = useVoiceOwner();
  const phase =
    owner !== key &&
    (currentPhase === 'opening' || currentPhase === 'recording' || currentPhase === 'processing')
      ? 'idle'
      : currentPhase;
  const request = useRef<AbortController | null>(null);
  const capture = useRef<Recording | undefined>(undefined);
  const upload = useMutation({
    mutationFn: ({ file, signal }: { file: File; signal: AbortSignal }) => transcribe(file, signal),
    gcTime: 0,
  });

  useEffect(() => {
    return () => {
      request.current?.abort();
      releaseVoice(key);
    };
  }, [key, enabled]);

  function cancel() {
    request.current?.abort();
    releaseVoice(key);
    setPhase('idle');
    setError(null);
    upload.reset();
  }

  async function submit(file: File, controller: AbortController) {
    const active = () => !controller.signal.aborted;
    if (!active()) return;
    setPhase('processing');
    try {
      if (file.size === 0 || file.size > MAX_VOICE_BYTES) {
        setError('size');
        setPhase('error');
        return;
      }
      const text = await upload.mutateAsync({ file, signal: controller.signal });
      if (!active()) return;
      if (text.trim()) {
        if (onText(text.trim())) setPhase('done');
        else {
          setError('length');
          setPhase('error');
        }
      } else {
        setError('empty');
        setPhase('error');
      }
    } catch {
      if (active()) {
        setError('failed');
        setPhase('error');
      }
    } finally {
      if (request.current === controller) {
        releaseVoice(key);
        upload.reset();
      }
    }
  }

  function send(file: File) {
    if (!enabled || !acquireVoice(key)) return;
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setStopReason('manual');
    void submit(file, controller);
  }

  async function start() {
    if (!enabled || !acquireVoice(key)) return;
    const controller = new AbortController();
    request.current = controller;
    setPhase('opening');
    setError(null);
    setSeconds(0);
    setStopReason('manual');
    capture.current = undefined;
    const hidden = () => {
      if (document.visibilityState === 'hidden' && !capture.current) cancel();
    };
    const removeHidden = () => document.removeEventListener('visibilitychange', hidden);
    document.addEventListener('visibilitychange', hidden);
    controller.signal.addEventListener('abort', removeHidden, { once: true });
    try {
      const recording = await beginRecording({
        signal: controller.signal,
        onStart: () => setPhase('recording'),
        onTick: setSeconds,
        onFinish: (file, reason) => {
          setStopReason(reason);
          void submit(file, controller);
        },
        onError: () => {
          setPhase('error');
          setError('microphone');
          releaseVoice(key);
        },
      });
      if (request.current === controller && !controller.signal.aborted) capture.current = recording;
    } catch {
      if (!controller.signal.aborted) {
        setPhase('error');
        setError('microphone');
        releaseVoice(key);
      }
    } finally {
      removeHidden();
      controller.signal.removeEventListener('abort', removeHidden);
    }
  }

  return {
    phase,
    error,
    seconds,
    stopReason,
    start,
    send,
    cancel,
    accept: () => {
      setPhase('done');
      setError(null);
    },
    stop: () => capture.current?.stop(),
    blocked: owner !== null && owner !== key,
  };
}
