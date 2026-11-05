import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginRecording } from './recording';

class Recorder {
  static latest: Recorder;
  static isTypeSupported() {
    return true;
  }
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    Recorder.latest = this;
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio']) });
    this.onstop?.();
  }
}

const descriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
let sound = 0;
const closeAudio = vi.fn();
class Audio {
  state = 'running';
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createAnalyser() {
    return { fftSize: 1024, getFloatTimeDomainData: (data: Float32Array) => data.fill(sound) };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    closeAudio();
    return Promise.resolve();
  }
}

describe('bounded microphone capture', () => {
  const stop = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.stubGlobal('MediaRecorder', Recorder);
    vi.stubGlobal('AudioContext', undefined);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    stop.mockClear();
    closeAudio.mockClear();
    sound = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (descriptor) Object.defineProperty(navigator, 'mediaDevices', descriptor);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  async function record() {
    const controller = new AbortController();
    const finish = vi.fn();
    const tick = vi.fn();
    const capture = await beginRecording({
      signal: controller.signal,
      onStart: vi.fn(),
      onTick: tick,
      onFinish: finish,
      onError: vi.fn(),
    });
    return { controller, finish, tick, capture };
  }

  it('automatically ends a forgotten recording before two minutes, without Web Audio', async () => {
    const { finish, tick } = await record();
    vi.advanceTimersByTime(118000);
    expect(finish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(finish).toHaveBeenCalledWith(expect.any(File), 'limit');
    expect(stop).toHaveBeenCalledOnce();
    const count = tick.mock.calls.length;
    vi.advanceTimersByTime(120000);
    expect(finish).toHaveBeenCalledOnce();
    expect(tick).toHaveBeenCalledTimes(count);
  });

  it('stops after ten seconds of silence, resetting the silence clock when speech resumes', async () => {
    vi.stubGlobal('AudioContext', Audio);
    const { finish } = await record();
    vi.advanceTimersByTime(9000);
    expect(finish).not.toHaveBeenCalled();
    sound = 0.1;
    vi.advanceTimersByTime(2000);
    sound = 0;
    vi.advanceTimersByTime(9750);
    expect(finish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(finish).toHaveBeenCalledWith(expect.any(File), 'silence');
    expect(stop).toHaveBeenCalledOnce();
    expect(closeAudio).toHaveBeenCalledOnce();
  });

  it('ignores a suspended analyser and still enforces the hard limit', async () => {
    class SuspendedAudio extends Audio {
      override state = 'suspended';
    }
    vi.stubGlobal('AudioContext', SuspendedAudio);
    const { finish } = await record();
    vi.advanceTimersByTime(20000);
    expect(finish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99000);
    expect(finish).toHaveBeenCalledWith(expect.any(File), 'limit');
  });

  it('stops and keeps the captured audio for transcription when the tab becomes hidden', async () => {
    const { finish } = await record();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(finish).toHaveBeenCalledWith(expect.any(File), 'hidden');
    expect(stop).toHaveBeenCalledOnce();
  });

  it('cancels without uploading and releases the microphone immediately', async () => {
    const { controller, finish } = await record();
    controller.abort();
    expect(stop).toHaveBeenCalledOnce();
    expect(finish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200000);
    expect(finish).not.toHaveBeenCalled();
  });
});
