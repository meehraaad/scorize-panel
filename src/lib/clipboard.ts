/**
 * Copies text. Browsers give `navigator.clipboard` only to secure pages (https, localhost): on a
 * plain-http address (a LAN IP) it is undefined, and calling it throws before any promise exists.
 * There, and when the Clipboard API refuses, a hidden textarea is selected and copied the old way.
 * Rejects when neither worked, so the caller can say so.
 */
export async function copyText(text: string): Promise<void> {
  const clipboard = (navigator as Partial<Navigator>).clipboard;
  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // Refused (no permission, page not focused): try the old way.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.inset = '0 auto auto 0';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  let copied: boolean;
  try {
    // The only copy that works without the Clipboard API; deprecated but still supported everywhere.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  } finally {
    area.remove();
  }
  if (!copied) throw new Error('Copy failed');
}
