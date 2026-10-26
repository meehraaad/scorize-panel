import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookingDialog } from '@/components/applicant/booking/BookingDialog';
import { preloadBooking } from '@/components/applicant/booking/preload';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import {
  CALL_TIMES,
  useCallRequest,
  type ApplicantAccess,
  type CallTime,
} from '@/lib/applicant/access';
import { CONSULTATION_MODES, type ConsultationMode } from '@/lib/applicant/booking';
import type { StartOffers } from '@/lib/applicant/journey';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { toast } from '@/lib/toast';

/**
 * "Rather talk?": book a consultation, starting with its first step, online or in person (each
 * opens the booking dialog on that choice), with a free call as the smaller way. Without a
 * consultation on offer, the call alone.
 */
export function TalkCard({ access, offers }: { access: ApplicantAccess; offers: StartOffers }) {
  if (!offers.consultation || !ON_SERVER.bookingCalendar) return <CallTimeCard access={access} />;
  return <BookTalkCard access={access} />;
}

function BookTalkCard({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('journey');
  const [booking, setBooking] = useState<ConsultationMode | null>(null);
  return (
    <Card aria-labelledby="journey-call" className="flex flex-col gap-4 p-5 lg:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="journey-call" className="m-0 text-lg font-bold">
          {t('callTime.title')}
        </h2>
        <p className="m-0 text-sm leading-6 text-text-2">{t('callTime.book')}</p>
      </div>
      <div role="group" aria-label={t('callTime.how')} className="grid gap-3 sm:grid-cols-2">
        {CONSULTATION_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-haspopup="dialog"
            onPointerEnter={preloadBooking}
            onFocus={preloadBooking}
            onClick={() => setBooking(mode)}
            className="group flex min-h-20 items-center gap-4 rounded-2xl p-4 text-start shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-row-highlight hover:shadow-[inset_0_0_0_1.5px_var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span
              aria-hidden="true"
              className="flex size-12 flex-none items-center justify-center rounded-2xl bg-tint text-primary-text group-hover:bg-primary group-hover:text-on-primary"
            >
              <Icon name={mode === 'online' ? 'video' : 'building'} size={22} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base font-bold text-text">
                {t(`callTime.modes.${mode}.title`)}
              </span>
              <span className="text-[13px] leading-6 text-text-2">
                {t(`callTime.modes.${mode}.line`)}
              </span>
            </span>
            <Icon name="chevronEnd" size={18} className="text-text-2" />
          </button>
        ))}
      </div>
      <CallRequestButton
        label={t('callTime.free')}
        className={buttonClass('outline', 'self-start')}
        phone={access.phone}
        topic="admission"
        page="home"
        reason="guest"
      />
      <BookingDialog
        open={booking !== null}
        onClose={() => setBooking(null)}
        initial={{ mode: booking }}
      />
    </Card>
  );
}

/**
 * The free call: with the account's phone known, picking when to be called is the whole request
 * (one tap, no form). Without one, the usual call-request dialog asks for it. Design: "Scorize New
 * User Dashboard v2" canvas, FirstVisit (side doors).
 */
function CallTimeCard({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('journey');
  const { t: common } = useTranslation();
  const send = useCallRequest();
  const [time, setTime] = useState<CallTime>('morning');
  const [sent, setSent] = useState<CallTime | null>(null);
  if (!ON_SERVER.callRequest) return null;

  const call = () => {
    if (!access.phone) return;
    send.mutate(
      { phone: access.phone, topics: ['admission'], time, page: 'home', reason: 'guest' },
      {
        onSuccess: () => {
          setSent(time);
          toast.success(t('callTime.sent'));
        },
        onError: () => toast.error(common('lock.call.error')),
      },
    );
  };

  return (
    <Card aria-labelledby="journey-call" className="flex flex-col gap-3 p-5 lg:p-6">
      <h2 id="journey-call" className="m-0 text-base font-bold">
        {t('callTime.title')}
      </h2>
      <p className="m-0 text-[13px] leading-6 text-text-2">{t('callTime.text')}</p>
      {sent ? (
        <p className="m-0 flex items-center gap-2 text-sm font-semibold text-good">
          <Icon name="check" size={16} />
          {t('callTime.done', { time: common(`lock.call.times.${sent}`) })}
        </p>
      ) : access.phone ? (
        <>
          <ChoiceGroup
            legend={t('callTime.legend')}
            hideLegend
            options={CALL_TIMES.map((value) => ({
              value,
              label: common(`lock.call.times.${value}`),
            }))}
            value={time}
            onChange={setTime}
          />
          <Button variant="outline" className="w-full" disabled={send.isPending} onClick={call}>
            {t('callTime.call')}
          </Button>
        </>
      ) : (
        <CallRequestButton
          label={t('callTime.call')}
          className={buttonClass('outline', 'w-full')}
          phone={null}
          topic="admission"
          page="home"
          reason="guest"
        />
      )}
    </Card>
  );
}
