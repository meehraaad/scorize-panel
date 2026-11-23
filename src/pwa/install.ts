export type InstallPlatform = 'android' | 'iphone';

interface AndroidInstallEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
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
  if (/iPhone/i.test(userAgent)) return 'iphone';
  return null;
}

export const installPlatform = detectInstallPlatform();

let androidPrompt: AndroidInstallEvent | null = null;
const subscribers = new Set<() => void>();

// Chrome can offer installation before the dialog chunk has loaded. Keep that event for the
// Install button, since a native prompt must be triggered by a user gesture.
if (installPlatform === 'android') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    androidPrompt = event as AndroidInstallEvent;
    subscribers.forEach((notify) => notify());
  });
}

export function getAndroidPrompt() {
  return androidPrompt;
}

export function subscribeToAndroidPrompt(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

export function rememberInstallDismissal() {
  try {
    sessionStorage.setItem(dismissalKey, 'true');
  } catch {
    // Dismissal still applies to the current page.
  }
}
