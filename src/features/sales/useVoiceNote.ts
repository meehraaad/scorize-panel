import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { transcribeVoice, VOICE_MAX_BYTES, VOICE_MAX_SECONDS } from '@/lib/sales/voice';

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function useVoiceNote(onText: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<'microphone' | 'size' | 'failed' | 'empty' | null>(null);
  const controller = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const generation = useRef(0);
  const upload = useMutation({
    mutationFn: ({ file, signal }: { file: File; signal: AbortSignal }) =>
      transcribeVoice(file, signal),
  });

  function stopTracks() {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  function cancel() {
    generation.current += 1;
    controller.current?.abort();
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stopTracks();
    setRecording(false);
    setOpening(false);
    upload.reset();
  }

  useEffect(() => {
    return () => {
      generation.current += 1;
      controller.current?.abort();
      if (recorder.current?.state === 'recording') recorder.current.stop();
      clearTimeout(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function send(file: File, version = generation.current) {
    setError(null);
    if (file.size === 0 || file.size > VOICE_MAX_BYTES) {
      setError('size');
      return;
    }
    const request = new AbortController();
    controller.current = request;
    try {
      const text = await upload.mutateAsync({ file, signal: request.signal });
      if (request.signal.aborted || version !== generation.current) return;
      if (text.trim()) onText(text.trim());
      else setError('empty');
    } catch {
      if (!request.signal.aborted && version === generation.current) setError('failed');
    }
  }

  async function start() {
    const version = ++generation.current;
    setError(null);
    setOpening(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (version !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = next;
      const chunks: Blob[] = [];
      let bytes = 0;
      next.ondataavailable = (event) => {
        bytes += event.data.size;
        chunks.push(event.data);
        if (bytes > VOICE_MAX_BYTES && next.state === 'recording') next.stop();
      };
      next.onerror = () => {
        if (version !== generation.current) return;
        generation.current += 1;
        stopTracks();
        setRecording(false);
        setError('microphone');
      };
      next.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        if (version !== generation.current) return;
        stopTracks();
        setRecording(false);
        const blob = new Blob(chunks, { type: next.mimeType });
        const extension = next.mimeType.includes('mp4')
          ? 'mp4'
          : next.mimeType.includes('ogg')
            ? 'ogg'
            : 'webm';
        void send(new File([blob], `voice.${extension}`, { type: blob.type }), version);
      };
      next.start(1000);
      setRecording(true);
      timer.current = setTimeout(
        () => {
          if (next.state === 'recording') next.stop();
        },
        (VOICE_MAX_SECONDS - 1) * 1000,
      ); // Leave room for the encoder's final audio frame.
    } catch {
      if (version === generation.current) {
        stopTracks();
        setError('microphone');
      }
    } finally {
      if (version === generation.current) setOpening(false);
    }
  }

  return {
    recording,
    opening,
    pending: upload.isPending,
    error,
    start,
    send,
    cancel,
    stop: () => recorder.current?.stop(),
  };
}
