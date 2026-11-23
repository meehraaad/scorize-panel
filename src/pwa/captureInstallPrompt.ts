interface AndroidInstallEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export let androidPrompt: AndroidInstallEvent | null = null;

// The browser can offer installation before the lazy PWA bundle finishes loading.
if (
  import.meta.env.PROD &&
  import.meta.env.VITE_ENABLE_PWA === 'true' &&
  /Android/i.test(navigator.userAgent)
) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    androidPrompt = event as AndroidInstallEvent;
  });
}
