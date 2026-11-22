import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { beginRecording } from '@/lib/voice/recording';
import type { ServerFeature } from '@/lib/applicant/onServer';
import { renderApp } from '@/test/renderApp';
import '@/test/server';

vi.mock('@/lib/applicant/onServer', async (original) => {
  const actual = await original<{ ON_SERVER: Readonly<Record<ServerFeature, boolean>> }>();
  return { ...actual, ON_SERVER: { ...actual.ON_SERVER, ticketVoice: true } };
});
vi.mock('@/lib/voice/recording', () => ({ beginRecording: vi.fn() }));

describe('ticket voice messages', () => {
  const revoke = vi.fn();
  const descriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  beforeEach(async () => {
    await i18n.changeLanguage('fa');
    localStorage.setItem('scorize.mock.session', '1');
    vi.stubGlobal('MediaRecorder', vi.fn());
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    revoke.mockClear();
    URL.revokeObjectURL = revoke;
    vi.mocked(beginRecording).mockImplementation(({ onStart, onFinish }) => {
      onStart();
      return Promise.resolve({
        stop: () =>
          onFinish(
            new File(['recording'], 'voice.webm', { type: 'audio/webm;codecs=opus' }),
            'manual',
          ),
      });
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    if (descriptor) Object.defineProperty(navigator, 'mediaDevices', descriptor);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('records, previews and sends audio without requiring typed text', async () => {
    const user = userEvent.setup();
    renderApp('/tickets');
    await user.click(await screen.findByRole('button', { name: 'ضبط پیام صوتی' }));
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'پایان ضبط' }));
    expect(await screen.findByLabelText('پیش‌نمایش پیام صوتی')).toHaveAttribute(
      'src',
      'blob:preview',
    );
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'ارسال' }));
    expect(await screen.findByLabelText('پخش پیام صوتی')).toHaveAttribute(
      'src',
      expect.stringContaining('voice.webm'),
    );
    await waitFor(() => expect(screen.queryByLabelText('پیش‌نمایش پیام صوتی')).toBeNull());
    expect(revoke).toHaveBeenCalledWith('blob:preview');
  });

  it('cancels recording and never turns the discarded audio into an attachment', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(beginRecording).mockImplementation((options) => {
      signal = options.signal;
      options.onStart();
      return Promise.resolve({ stop: vi.fn() });
    });
    const user = userEvent.setup();
    const router = renderApp('/tickets');
    await user.click(await screen.findByRole('button', { name: 'ضبط پیام صوتی' }));
    await user.click(screen.getByRole('button', { name: 'لغو ضبط' }));
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByLabelText('پیش‌نمایش پیام صوتی')).toBeNull();
    expect(screen.getByRole('button', { name: 'ارسال' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'ضبط پیام صوتی' }));
    await act(() => router.navigate('/account'));
    expect(signal?.aborted).toBe(true);
  });
});
