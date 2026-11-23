import { androidPrompt } from './captureInstallPrompt';

export type InstallPlatform = 'android' | 'iphone';

const dismissalKey = 'scorize.pwaInstallDismissed';

function detectInstallPlatform(): InstallPlatform | null {
  if (
    !import.meta.env.PROD ||
    import.meta.env.VITE_ENABLE_PWA !== 'true' ||
    !window.isSecureContext
  ) {
    return null;
  }

  const { userAgent, standalone } = navigator as Navigator & { standalone?: boolean };
  if (standalone || window.matchMedia('(display-mode: standalone)').matches) return null;

  try {
    if (sessionStorage.getItem(dismissalKey)) return null;
  } catch {
    // The dialog still works if storage is blocked.
  }

  if (/Android/i.test(userAgent)) return 'android';
  if (/iPhone/i.test(userAgent)) return 'iphone';
  return null;
}

export const installPlatform = detectInstallPlatform();

export function getAndroidPrompt() {
  return androidPrompt;
}

export function subscribeToAndroidPrompt(notify: () => void) {
  window.addEventListener('beforeinstallprompt', notify);
  return () => window.removeEventListener('beforeinstallprompt', notify);
}

export function rememberInstallDismissal() {
  try {
    sessionStorage.setItem(dismissalKey, 'true');
  } catch {
    // Dismissal still applies to the current page.
  }
}
