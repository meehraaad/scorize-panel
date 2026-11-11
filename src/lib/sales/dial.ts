import { useSyncExternalStore } from 'react';

/**
 * "Call with Linphone" on this device: the seller turns it on in Settings > Mobile phone, on the phone
 * where Linphone is set up. Stored per device (the computer keeps its normal `tel:` links), as the
 * PBX's SIP domain, which the call link needs.
 */
const STORAGE_KEY = 'scorize.sales.linphoneDomain';
const CHANGE_EVENT = 'scorize:linphone-dial';

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setLinphoneDial(domain: string | null) {
  try {
    if (domain) localStorage.setItem(STORAGE_KEY, domain);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the choice can't be kept on this device.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The SIP domain while Linphone dialling is on for this device, else null. */
export function useLinphoneDial() {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** 09121234567, +98 912…, 0098 912… → 989121234567: how the office PBX dials an outside number. */
export function pbxNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0098')) return digits.slice(2);
  if (digits.startsWith('98') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `98${digits.slice(1)}`;
  return digits;
}

/** The link a "call" button opens: Linphone through the office line when it's on, else the phone app. */
export function callHref(phone: string, linphoneDomain: string | null) {
  if (!linphoneDomain) return `tel:${phone}`;
  return `sip:${pbxNumber(phone)}@${linphoneDomain}`;
}

/** `href` for a call button, following this device's Linphone setting. */
export function useCallHref(phone: string) {
  return callHref(phone, useLinphoneDial());
}
