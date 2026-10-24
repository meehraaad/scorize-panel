/**
 * jsdom's XMLHttpRequest can't send the Node FormData tests use (vitest.node-globals.ts), so
 * uploads (`uploadApi`) go through this stand-in: the same calls the app makes, sent with fetch
 * so MSW answers them. It reports the whole body as sent in one progress event.
 */
class FetchXMLHttpRequest {
  status = 0;
  responseText = '';
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private method = 'GET';
  private url = '';
  private headers = new Headers();
  private controller = new AbortController();

  open(method: string, url: string) {
    this.method = method;
    this.url = new URL(url, window.location.origin).href;
  }

  setRequestHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  abort() {
    this.controller.abort();
  }

  send(body?: BodyInit | null) {
    fetch(this.url, {
      method: this.method,
      headers: this.headers,
      body: body ?? null,
      signal: this.controller.signal,
    }).then(
      async (response) => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 } as ProgressEvent);
        this.status = response.status;
        this.responseText = await response.text();
        this.onload?.();
      },
      () => {
        if (!this.controller.signal.aborted) this.onerror?.();
      },
    );
  }
}

Object.defineProperty(globalThis, 'XMLHttpRequest', {
  value: FetchXMLHttpRequest,
  writable: true,
  configurable: true,
});
