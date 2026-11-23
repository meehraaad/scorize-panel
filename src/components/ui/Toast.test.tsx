import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Toaster } from './Toast';

describe('Toaster', () => {
  it('comes back to the page when the modal it moved into is taken out', async () => {
    // jsdom doesn't know `:modal`: an open dialog is one, as in a browser after showModal().
    // Kept to call with each element as `this` (`matches.call`), so unbound on purpose.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector) {
      return selector === ':modal' ? this.hasAttribute('open') : matches.call(this, selector);
    });
    render(<Toaster />);
    // A modal opens: the toasts move inside it, above its buttons.
    const dialog = document.createElement('dialog');
    document.body.append(dialog);
    await act(async () => {
      dialog.setAttribute('open', '');
      await Promise.resolve();
    });
    expect(dialog.querySelector('section')).not.toBeNull();
    // React unmounts the dialog after a save (no `open` change): the next toast still shows.
    await act(async () => {
      dialog.remove();
      await Promise.resolve();
    });
    act(() => {
      toast.success('پرونده ساخته شد');
    });
    expect(await screen.findByText('پرونده ساخته شد')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
