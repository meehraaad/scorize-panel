import { ON_SERVER } from '@/lib/applicant/onServer';
import { submitTelemetry, telemetryAllowed, telemetryPage } from '@/lib/browserTelemetry';

const hostname = window.location.hostname;
const sharedDomain = ['scorize.com', 'www.scorize.com', 'panel.scorize.com'].includes(hostname);
const cookie =
  !sharedDomain && hostname.endsWith('.scorize.com')
    ? 'scorize_acquisition_preview'
    : 'scorize_acquisition';
const booking = '/panel/consultations/book';
const trackedPages = new Set(['/panel/', '/panel/login', booking]);
const internalAreas =
  /^\/panel\/(?:founders|marketing|sales|supervisor|writer|executive|hr|dev)(?:\/|$)/;

function report(
  event: 'visit' | 'consultation_cta' | 'booking_started',
  location: Pick<Location, 'pathname' | 'search'> = window.location,
) {
  if (!ON_SERVER.acquisition || !telemetryAllowed() || !window.isSecureContext) return;
  const path = telemetryPage(location.pathname);
  if (internalAreas.test(path)) return;
  if (!document.cookie.split('; ').some((entry) => entry.startsWith(cookie + '='))) {
    document.cookie = `${cookie}=${crypto.randomUUID()}; Path=/; Max-Age=2592000; SameSite=Lax; Secure${sharedDomain ? '; Domain=scorize.com' : ''}`;
  }
  const params = new URLSearchParams(location.search);
  const attribution: Record<string, string> = {};
  for (const key of ['source', 'medium', 'campaign']) {
    const value = params.get(`utm_${key}`);
    if (value && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value)) attribution[key] = value;
  }
  submitTelemetry('acquisition/', {
    event,
    page: trackedPages.has(path) ? path : '/panel/other',
    ...attribution,
  });
}

export function reportConsultationStart() {
  report('booking_started');
}

export function startAcquisition(landing: URL) {
  report('visit', landing);
  document.addEventListener('click', (event) => {
    const link =
      event.target instanceof Element && event.target.closest<HTMLAnchorElement>('a[href]');
    if (link && link.origin === location.origin && telemetryPage(link.pathname) === booking) {
      report('consultation_cta');
    }
  });
}
