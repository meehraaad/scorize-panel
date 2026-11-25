import { ON_SERVER } from '@/lib/applicant/onServer';
import { startAcquisition } from '@/lib/acquisition';
import { watchClientCrashes } from '@/lib/clientErrors';
import { reportWebVitals } from '@/lib/vitals';

export function startTelemetry(landing: URL) {
  if (ON_SERVER.siteHealth) {
    reportWebVitals(landing.pathname);
    watchClientCrashes();
  }
  if (ON_SERVER.acquisition) startAcquisition(landing);
}
