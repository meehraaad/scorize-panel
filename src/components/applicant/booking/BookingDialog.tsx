import { useQuery } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { QuerySection } from '@/components/ui/QuerySection';
import { firstCalendarQuery } from '@/lib/applicant/booking';
import { weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';

const Flow = lazy(() => import('./BookingFlow'));

/**
 * Booking a consultation in a large window over the page (the whole screen on phones): the same
 * flow as the booking page, its code and first read fetched on first open (or earlier with
 * `preloadBooking` in ./preload, when the pointer reaches the opener). `initial` opens it on a choice.
 */
export function BookingDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { mode?: string | null; type?: number } | undefined;
}) {
  const { t } = useTranslation('booking');
  return (
    <Dialog size="wide" open={open} onClose={onClose} title={t('dialog')} closeLabel={t('close')}>
      <Body initial={initial} />
    </Dialog>
  );
}

function Body({ initial }: { initial?: { mode?: string | null; type?: number } | undefined }) {
  const cal = useCalendar();
  const query = useQuery(firstCalendarQuery(weekStart(cal.kind)));
  const bones = <Bones />;
  return (
    <QuerySection pending={query.isPending} error={query.error} retry={() => void query.refetch()}>
      <Suspense fallback={bones}>
        <Flow initial={initial} />
      </Suspense>
    </QuerySection>
  );
}

/** The flow's shape while its code arrives: the steps beside the calendar. */
function Bones() {
  const { t } = useTranslation('booking');
  return (
    <div role="status" aria-label={t('loading')} className="flex flex-wrap gap-4 lg:gap-6">
      <div className="flex flex-[1_1_300px] flex-col gap-4 lg:max-w-80">
        <span className="block h-28 animate-pulse rounded-card-sm bg-track" />
        <span className="block h-64 animate-pulse rounded-card-sm bg-track" />
      </div>
      <span className="block h-[480px] min-w-0 flex-[999_1_560px] animate-pulse rounded-card-sm bg-track" />
    </div>
  );
}
