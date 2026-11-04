export const MAX_VOICE_SECONDS = 120;
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;
export const SILENCE_SECONDS = 10;

export type Transcribe = (file: File, signal: AbortSignal) => Promise<string>;
export type StopReason = 'manual' | 'silence' | 'limit' | 'hidden';
export type VoiceError = 'microphone' | 'size' | 'failed' | 'empty' | 'length';
export type VoicePhase = 'idle' | 'opening' | 'recording' | 'processing' | 'done' | 'error';
