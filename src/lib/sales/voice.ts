import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { SALES_API, SALES_KEY } from './api';

const PATH = `${SALES_API}/voice/`;

export const voiceCapabilityQuery = queryOptions({
  queryKey: [...SALES_KEY, 'voice'],
  queryFn: ({ signal }) => api<{ enabled: boolean }>(PATH, { signal }),
  staleTime: 60_000,
  retry: false,
});

interface VoiceJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  text?: string;
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, 1500);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

/** Short upload + polling: inference never holds a Django request open. */
export async function transcribeVoice(file: File, signal: AbortSignal): Promise<string> {
  const body = new FormData();
  body.set('audio', file);
  const job = await api<VoiceJob>(PATH, { method: 'POST', body, signal });
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await pause(signal);
    const result = await api<VoiceJob>(`${PATH}${encodeURIComponent(job.id)}/`, { signal });
    if (result.status === 'failed') throw new Error('Transcription failed');
    if (result.status === 'done') return result.text ?? '';
  }
  throw new Error('Transcription timed out');
}
