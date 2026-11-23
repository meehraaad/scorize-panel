import { androidPrompt } from './captureInstallPrompt';

export type InstallPlatform = 'android' | 'iphone-safari' | 'iphone-other';

export function isIphoneSafari(userAgent: string): boolean {
  // iOS browsers share WebKit and often include Safari/ in their user agent. Safari's Version/
  // token and final Safari/ product identify normal Safari tabs. Embedded browsers can spoof this.
  return (
    /\biPhone\b.*\bVersion\/[\d.]+.*\bMobile\/\S+.*\bSafari\/[\d.]+$/i.test(userAgent) &&
    !/\b(?:CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Brave|GSA|Instagram|FBAN|FBAV)\b/i.test(userAgent)
  );
}

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
  if (/\biPhone\b/i.test(userAgent))
    return isIphoneSafari(userAgent) ? 'iphone-safari' : 'iphone-other';
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
