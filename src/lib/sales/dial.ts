import { useSyncExternalStore } from 'react';

/**
 * "Call with Linphone" on this device: the seller turns it on in Settings > Mobile phone, on the phone
 * where Linphone is set up. Stored per device: the computer keeps its normal `tel:` links.
 */
// Older builds stored the PBX domain here; any non-empty value means "on".
const STORAGE_KEY = 'scorize.sales.linphoneDomain';
const CHANGE_EVENT = 'scorize:linphone-dial';

function read(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function setLinphoneDial(on: boolean) {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1');
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

/** Linphone dialling is on for this device. */
export function useLinphoneDial() {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** 09121234567, +98 912…, 0098 912… → 989121234567: how the office PBX dials an outside number. */
export function pbxNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0098')) return digits.slice(2);
  if (digits.startsWith('98') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `98${digits.slice(1)}`;
  return digits;
}

/**
 * The link a "call" button opens: Linphone through the office line when it's on, else the phone app.
 * `linphone-sip:` is Linphone's own scheme (iOS and Android), so no other SIP app takes the tap; with
 * no domain, Linphone calls through its own account (the seller's extension) and dials at once.
 */
export function callHref(phone: string, linphone: boolean) {
  return linphone ? `linphone-sip:${pbxNumber(phone)}` : `tel:${phone}`;
}

/** A "call" button that opens the contact form also starts the Linphone call when it's on here. */
export function dialWithLinphone(phone: string | undefined) {
  if (phone && read()) window.location.assign(callHref(phone, true));
}

/** `href` for a call button, following this device's Linphone setting. */
export function useCallHref(phone: string) {
  return callHref(phone, useLinphoneDial());
}
