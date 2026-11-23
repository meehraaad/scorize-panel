import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const setClipboard = (value: unknown) => {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
};
const setExecCommand = (value: unknown) => {
  Object.defineProperty(document, 'execCommand', { value, configurable: true, writable: true });
};

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the Clipboard API when the page has it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await copyText('سلام');
    expect(writeText).toHaveBeenCalledWith('سلام');
  });

  it('falls back to a hidden textarea on a plain-http page (no Clipboard API)', async () => {
    setClipboard(undefined);
    const exec = vi.fn().mockReturnValue(true);
    setExecCommand(exec);
    await copyText('http://192.168.1.5/panel/login');
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the Clipboard API refuses, and rejects when nothing worked', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    setExecCommand(vi.fn().mockReturnValue(false));
    await expect(copyText('x')).rejects.toThrow('Copy failed');
  });
});
