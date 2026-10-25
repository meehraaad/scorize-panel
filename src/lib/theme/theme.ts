export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

// Same key the pre-paint script in index.html reads.
export const THEME_STORAGE_KEY = 'scorize.theme';

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readStoredMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : 'system';
  } catch {
    return 'system';
  }
}

export function storeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode;
  return darkQuery().matches ? 'dark' : 'light';
}

// Browser chrome / installed-PWA title bar colour; matches --canvas in tokens.css.
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#F6F4F7', dark: '#111113' };

export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', THEME_COLOR[theme]);
    meta.removeAttribute('media');
  });
}

export function subscribeToSystemTheme(onChange: () => void) {
  const query = darkQuery();
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
