/**
 * Pages of the main site (Django, same domain) the panel links to, and the support line.
 * Paths checked against the scorize repo's urls.py; update here if a page moves.
 */
export const SITE = {
  home: '/',
  /** Same PDF the main site's footer links to. */
  terms: encodeURI('/static/قوانین سایت اسکورایز.pdf'),
  estimateAdmission: '/estimation/estimate-admission/',
  consultation: '/consultation/',
  admissionSamples: '/blog/admission_sample/list/',
} as const;

/** Support phone, digits only (for tel: links). Shown formatted with `formatPhone`. */
export const SUPPORT_PHONE = '02191018457';

/** 02191018457 → 021-91018457, 09123456789 → 0912 345 6789. Other values are returned as is. */
export function formatPhone(value: string) {
  if (/^0[1-8]\d{9}$/.test(value)) return `${value.slice(0, 3)}-${value.slice(3)}`;
  if (/^09\d{9}$/.test(value)) return `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7)}`;
  return value;
}
