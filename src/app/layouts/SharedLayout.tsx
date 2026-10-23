import { useSession } from '@/lib/auth/session';
import { applicantPanel } from '@/panels/applicant';
import { preferredPanel } from '@/panels/registry';
import { PanelLayout } from './PanelLayout';

/** Account and settings belong to no panel: they show inside the panel the user was last in. */
export function SharedLayout() {
  const user = useSession();
  return <PanelLayout panel={user ? preferredPanel(user) : applicantPanel} />;
}

/** Shown while the session check and the first chunk load; the canvas colour is already painted. */
export function BootFallback() {
  return null;
}
