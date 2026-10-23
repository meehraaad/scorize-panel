const PANEL_BASE = import.meta.env.BASE_URL; // "/panel/"

/**
 * Where to go after login. Only same-origin paths are allowed, so a crafted
 * `?next=https://evil.example` (open redirect, used for phishing) falls back to the panel home.
 */
export function safeNextPath(raw: string | null, base = PANEL_BASE): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return base;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return base;
    const path = url.pathname + url.search + url.hash;
    // Never bounce back to the login page itself.
    return path.startsWith(`${base}login`) ? base : path;
  } catch {
    return base;
  }
}

/** In-app router path for a panel URL, or null if the URL belongs to the rest of the site. */
export function toRouterPath(path: string, base = PANEL_BASE): string | null {
  if (path === base.slice(0, -1)) return '/';
  return path.startsWith(base) ? `/${path.slice(base.length)}` : null;
}
