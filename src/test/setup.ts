import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@/lib/i18n';
import { toast } from '@/lib/toast';
import './xhr';

// Integration tests load lazy page chunks through Vite's transform: allow more than the 1 s default.
// On a 4-core laptop running every file in parallel, a cold chunk can take over 5 s; the test
// itself still fails at testTimeout (vitest.config.ts) if something never appears.
configure({ asyncUtilTimeout: 12_000 });

afterEach(() => {
  cleanup();
  toast.clear();
});

// jsdom has no matchMedia; the theme code needs it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom has no <dialog> methods: open/close it by attribute, and fire `close` like browsers do.
if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    show(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
}

// jsdom doesn't lay out pages, so it has no scrollIntoView.
Element.prototype.scrollIntoView = () => {};
