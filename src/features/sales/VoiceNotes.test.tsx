import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import type sales from '@/locales/fa/sales.json';
import { renderApp } from '@/test/renderApp';
import { server } from '@/test/server';

const PATH = '/api/sales/v1/voice/';
const label = (key: keyof typeof sales.voice) => i18n.t(`voice.${key}`, { ns: 'sales' });
const microphoneDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

class Recorder {
  static instances: Recorder[] = [];
  static isTypeSupported() {
    return true;
  }
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    Recorder.instances.push(this);
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

async function open() {
  const user = userEvent.setup();
  renderApp('/sales/customers/101?log=call');
  await screen.findByRole('button', { name: label('upload') });
  return user;
}

describe('seller contact dictation', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('scorize.mock.session', '3');
    await i18n.changeLanguage('fa');
    await i18n.loadNamespaces('sales');
    server.use(http.get(PATH, () => HttpResponse.json({ enabled: true })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (microphoneDescriptor)
      Object.defineProperty(navigator, 'mediaDevices', microphoneDescriptor);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
    Recorder.instances = [];
  });

  it('reviews and edits the transcript, preserving notes typed while inference runs', async () => {
    const user = await open();
    const notes = screen.getByLabelText('یادداشت');
    await user.type(notes, 'یادداشت قبلی');
    await user.upload(
      screen.getByLabelText(label('upload')),
      new File(['audio'], 'note.wav', { type: 'audio/wav' }),
    );
    await screen.findByText(label('processing'));
    await user.type(notes, ' و توضیح تازه');
    const transcript = await screen.findByLabelText(label('transcript'));
    expect(notes).toHaveValue('یادداشت قبلی و توضیح تازه');
    await user.clear(transcript);
    await user.type(transcript, 'متن ویرایش‌شده');
    await user.click(screen.getByRole('button', { name: label('insert') }));
    expect(notes).toHaveValue('یادداشت قبلی و توضیح تازه\nمتن ویرایش‌شده');
    expect(screen.queryByLabelText(label('transcript'))).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(i18n.t('customer.logDialog.customerSummary', { ns: 'sales' })),
    ).toHaveValue('');
  });

  it('keeps the transcript in the correct customer draft when minimized', async () => {
    const user = await open();
    await user.upload(
      screen.getByLabelText(label('upload')),
      new File(['audio'], 'note.wav', { type: 'audio/wav' }),
    );
    await screen.findByLabelText(label('transcript'));
    const close = within(screen.getByRole('dialog')).getAllByRole('button', {
      name: 'کوچک کردن',
    })[0];
    if (!close) throw new Error('Missing minimize button');
    await user.click(close);
    await user.click(screen.getByRole('button', { name: 'ادامه‌ی ثبت ارتباط با کیانا رضوی' }));
    expect(await screen.findByLabelText(label('transcript'))).toHaveValue(
      'برای جلسهٔ بعد تماس بگیرید.',
    );
  });

  it('releases the microphone when the draft is minimized and does not submit cancelled audio', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    });
    vi.stubGlobal('MediaRecorder', Recorder);
    let uploads = 0;
    server.use(
      http.post(PATH, () => {
        uploads += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const user = await open();
    await user.click(screen.getByRole('button', { name: label('record') }));
    await screen.findByText(label('recording'));
    const close = within(screen.getByRole('dialog')).getAllByRole('button', {
      name: 'کوچک کردن',
    })[0];
    if (!close) throw new Error('Missing minimize button');
    await user.click(close);
    expect(stop).toHaveBeenCalled();
    expect(Recorder.instances[0]?.state).toBe('inactive');
    expect(uploads).toBe(0);
  });

  it('releases late microphone permission after cancellation', async () => {
    let grant: ((stream: unknown) => void) | undefined;
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          new Promise((resolve) => {
            grant = resolve;
          }),
      },
    });
    vi.stubGlobal('MediaRecorder', Recorder);
    const user = await open();
    await user.click(screen.getByRole('button', { name: label('record') }));
    await user.click(screen.getByRole('button', { name: label('cancel') }));
    await act(async () => {
      grant?.({ getTracks: () => [{ stop }] });
      await Promise.resolve();
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(Recorder.instances).toHaveLength(0);
  });

  it('shows a retryable failure without changing existing notes', async () => {
    server.use(http.get(`${PATH}:id/`, () => HttpResponse.json({ status: 'failed' })));
    const user = await open();
    await user.type(screen.getByLabelText('یادداشت'), 'Keep this');
    await user.upload(
      screen.getByLabelText(label('upload')),
      new File(['audio'], 'note.wav', { type: 'audio/wav' }),
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(label('failed')));
    expect(screen.getByLabelText('یادداشت')).toHaveValue('Keep this');
    expect(screen.getByRole('button', { name: label('upload') })).toBeEnabled();
  });
});
