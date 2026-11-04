import { SILENCE_SECONDS } from './types';

/** Local energy detection only. A hard recording limit still applies when Web Audio is unavailable. */
export function watchSilence(stream: MediaStream, onSilent: () => void): () => void {
  if (typeof AudioContext === 'undefined') return () => {};
  let context: AudioContext | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let lastSound = Date.now();
    timer = setInterval(() => {
      if (context?.state !== 'running') {
        lastSound = Date.now();
        return;
      }
      analyser.getFloatTimeDomainData(samples);
      const energy = Math.sqrt(
        samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
      );
      if (energy > 0.01) lastSound = Date.now();
      if (Date.now() - lastSound >= SILENCE_SECONDS * 1000) onSilent();
    }, 250);
    void context.resume().catch(() => {});
    return () => {
      clearInterval(timer);
      source.disconnect();
      if (context?.state !== 'closed') void context?.close().catch(() => {});
    };
  } catch {
    clearInterval(timer);
    if (context?.state !== 'closed') void context?.close().catch(() => {});
    return () => {};
  }
}
