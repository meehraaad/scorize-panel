import { PageSkeleton } from '@/components/ui/Skeleton';
import { usePageSkeleton } from '@/lib/router/lazyPage';
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

/**
 * First visit to a panel page: the panel's frame (the header capsule) and the page's skeleton,
 * drawn before the session check and the page's code have arrived, instead of a blank screen.
 */
export function PanelBootFallback() {
  const skeleton = usePageSkeleton();
  return (
    <div className="flex min-h-dvh flex-col [--panel-top:76px] lg:[--panel-top:92px]">
      <div
        aria-hidden="true"
        className="mx-auto flex h-(--panel-top) w-full max-w-page items-center px-4 lg:px-8"
      >
        <div className="h-14 w-full animate-appear rounded-full bg-surface shadow-panel lg:h-16" />
      </div>
      <div className="mx-auto w-full max-w-page flex-1 px-4 pb-10 lg:px-8">
        <PageSkeleton kind={skeleton} />
      </div>
    </div>
  );
}
