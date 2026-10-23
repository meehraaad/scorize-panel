import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyTheme,
  readStoredMode,
  resolveTheme,
  storeMode,
  subscribeToSystemTheme,
  type ResolvedTheme,
  type ThemeMode,
} from './theme';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(mode));

  useEffect(() => {
    const sync = () => {
      const next = resolveTheme(mode);
      setTheme(next);
      applyTheme(next);
    };
    sync();
    return mode === 'system' ? subscribeToSystemTheme(sync) : undefined;
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    storeMode(next);
    setModeState(next);
  }, []);

  const value = useMemo(() => ({ mode, theme, setMode }), [mode, theme, setMode]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}
