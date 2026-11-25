import { API_BASE } from '@/lib/api/client';

export function telemetryAllowed() {
  return (
    navigator.doNotTrack !== '1' &&
    !('globalPrivacyControl' in navigator && navigator.globalPrivacyControl === true)
  );
}

/** Keep route shapes and leave record IDs, opaque link tokens and search parameters out of reports. */
export function telemetryPage(path = window.location.pathname) {
  if (path === '/panel') return '/panel/';
  const panelPath = path.startsWith('/panel/') ? path : `/panel${path}`;
  return panelPath
    .replace(/^\/panel\/pay\/[^/]+/, '/panel/pay/:token')
    .split('/')
    .map((segment) =>
      /^[a-z][a-z-]{0,29}$|^:(?:id|token)$/.test(segment) || segment === ''
        ? segment
        : /^\d+$/.test(segment)
          ? ':id'
          : ':token',
    )
    .slice(0, 7)
    .join('/');
}

const errorNames = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
]);

export function telemetryError(error: Error) {
  const frames = (error.stack ?? '').matchAll(
    /https?:\/\/[^\s()]+?\/[\w.%/-]+\.(?:m?js|tsx?)(?=:\d+:\d+)/g,
  );
  const lines: string[] = [];
  for (const frame of frames) {
    const url = new URL(frame[0]);
    if (url.origin !== location.origin) continue;
    const position = error.stack
      ?.slice(frame.index + frame[0].length)
      .match(/^:\d{1,8}:\d{1,8}/)?.[0];
    const filename = url.pathname.split('/').at(-1);
    if (position && filename && /^[\w.-]{1,100}$/.test(filename)) lines.push(filename + position);
    if (lines.length === 4) break;
  }
  return { message: errorNames.has(error.name) ? error.name : 'Error', stack: lines.join('\n') };
}

export function submitTelemetry(resource: string, body: unknown) {
  const data = new Blob([JSON.stringify(body)], { type: 'application/json' });
  const endpoint = `${API_BASE}/metrics/v1/${resource}`;
  void fetch(endpoint, {
    method: 'POST',
    body: data,
    keepalive: true,
    referrerPolicy: 'origin',
  }).catch(() => undefined);
}
