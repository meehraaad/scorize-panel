const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * A link target that came from the API (file, receipt, meeting, payment gateway). Only http(s)
 * and same-origin paths pass, so a stored `javascript:` or `data:` URL can never run script when
 * someone clicks it. Anything else gives `undefined`: the link renders without an href.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    // Parses like the browser does (it trims spaces and control characters before the scheme).
    const { protocol } = new URL(url, window.location.origin);
    return SAFE_PROTOCOLS.has(protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}
