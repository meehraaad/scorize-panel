import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BookingDialog } from '@/components/applicant/booking/BookingDialog';
import { preloadBooking } from '@/components/applicant/booking/preload';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { Bone } from '@/components/ui/Skeleton';
import {
  CALL_TIMES,
  useCallRequest,
  type ApplicantAccess,
  type CallTime,
} from '@/lib/applicant/access';
import {
  firstCalendarQuery,
  useBookSlot,
  type BookableType,
  type BookingCalendar,
} from '@/lib/applicant/booking';
import { weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import type { StartOffers } from '@/lib/applicant/journey';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { toast } from '@/lib/toast';

/**
 * The consultation as one offer: its soonest free time over every way it is held, booked with one
 * tap (off to the bank gateway). "Another time" opens the booking calendar on that choice, and a
 * free call is the quieter way. Without a consultation on offer, the call alone.
 * Design: "کارت رزرو مشاوره" canvas, v2.
 */
export function TalkCard({ access, offers }: { access: ApplicantAccess; offers: StartOffers }) {
  if (!offers.consultation || !ON_SERVER.bookingCalendar) return <CallTimeCard access={access} />;
  return <BookTalkCard access={access} />;
}

/** The soonest time with a seat in the calendar's first read, with its consultation. */
interface Offer {
  type: BookableType;
  at: string | null;
}

/** The soonest free time from now on; without one, the first type on offer (for its price). */
function soonest(calendar: BookingCalendar | undefined, now: number): Offer | null {
  if (!calendar) return null;
  const slot = calendar.slots
    .filter(
      (item) =>
        item.left > 0 &&
        Date.parse(item.at) > now &&
        calendar.types.some((type) => type.id === item.type),
    )
    .sort((x, y) => Date.parse(x.at) - Date.parse(y.at))[0];
  const type = (slot && calendar.types.find((item) => item.id === slot.type)) ?? calendar.types[0];
  return type ? { type, at: slot?.at ?? null } : null;
}

function BookTalkCard({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const cal = useCalendar();
  const [now] = useState(() => new Date());
  // Listed in the home route's data; still a plain read, so a slow calendar never holds up the home.
  const calendar = useQuery(firstCalendarQuery(weekStart(cal.kind), now));
  const offer = soonest(calendar.data, now.getTime());
  const book = useBookSlot({
    booked: t('slots.booked'),
    taken: t('slots.taken'),
    error: t('slots.error'),
  });
  const toman = (amount: number) => t('slots.toman', { amount: f.number(amount) });
  const [booking, setBooking] = useState(false);
  const leaf = offer?.at ? f.dayMonth(offer.at) : null;

  const another = (
    <button
      type="button"
      aria-haspopup="dialog"
      onPointerEnter={preloadBooking}
      onFocus={preloadBooking}
      onClick={() => setBooking(true)}
      className={
        offer?.at || calendar.isPending
          ? 'inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary-text'
          : buttonClass('primary', 'w-full')
      }
    >
      <Icon name="calendar" size={17} />
      {offer?.at || calendar.isPending ? t('callTime.another') : t('callTime.pick')}
    </button>
  );

  return (
    <Card
      aria-labelledby="journey-call"
      className="flex flex-col overflow-hidden shadow-[var(--panel-shadow),var(--path-shadow)] lg:flex-row"
    >
      <div className="flex min-w-0 flex-col gap-2 px-5 pt-5 pb-4 lg:flex-1 lg:gap-3.5 lg:px-11 lg:py-10">
        <h2
          id="journey-call"
          className="m-0 font-display text-xl leading-[1.7] font-semibold lg:text-[26px] lg:leading-[1.65]"
        >
          <Trans
            ns="journey"
            i18nKey="callTime.offerTitle"
            components={{ em: <span className="text-primary-text" /> }}
          />
        </h2>
        <p className="m-0 max-w-[46ch] text-sm leading-7 text-text-2 lg:text-[15px] lg:leading-8">
          {t('callTime.offerText')}
        </p>
        <p className="m-0 mt-auto hidden pt-4.5 text-[13px] leading-7 text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:block">
          {t('callTime.after')}
        </p>
      </div>
      <div className="flex flex-col gap-3.5 bg-tint/50 px-5 pt-4.5 pb-2 lg:w-110 lg:flex-none lg:gap-4.5 lg:p-8">
        {calendar.isPending ? (
          <Bone className="h-17 rounded-card-sm!" />
        ) : offer?.at && leaf ? (
          <div className="flex items-center gap-3.5 lg:gap-4.5">
            <span
              aria-hidden="true"
              className="w-15 flex-none overflow-hidden rounded-xl bg-surface text-center shadow-[inset_0_0_0_1px_var(--line-2)] lg:w-19 lg:rounded-[14px]"
            >
              <span className="block bg-primary py-0.5 text-[11px] font-bold text-on-primary lg:py-1 lg:text-xs">
                {leaf.month}
              </span>
              <span className="block pt-0.5 pb-1.5 font-display text-2xl leading-snug font-bold lg:pt-1 lg:pb-2 lg:text-3xl">
                {leaf.day}
              </span>
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold text-primary-text">
                {t('callTime.soonest')}
              </span>
              <span className="text-[17px] font-extrabold lg:text-[19px]">
                {t('callTime.at', { day: f.weekdayName(offer.at), time: f.time(offer.at) })}
              </span>
              <span className="text-xs text-text-2 lg:text-[13px]">
                {t('callTime.modeMinutes', {
                  mode: t(`callTime.modes.${offer.type.mode}.title`),
                  n: f.number(offer.type.minutes),
                })}
              </span>
            </span>
          </div>
        ) : (
          <p className="m-0 text-sm leading-6 text-text-2">
            {calendar.isError ? t('callTime.error') : t('callTime.none')}
          </p>
        )}
        {offer && (
          <p className="m-0 flex items-baseline justify-between gap-3 text-[13px] text-text-2 lg:pt-4 lg:shadow-[inset_0_1px_0_var(--hair)]">
            {t('slots.price')}
            <span className="inline-flex items-baseline gap-2.5">
              {offer.type.full_price !== null && offer.type.full_price > offer.type.price && (
                <s>{f.number(offer.type.full_price)}</s>
              )}
              <span className="font-display text-lg font-bold text-text lg:text-xl">
                {toman(offer.type.price)}
              </span>
            </span>
          </p>
        )}
        {offer?.at ? (
          <Button
            size="lg"
            className="w-full"
            disabled={book.pending}
            onClick={() => offer.at && book.submit(offer.type.id, offer.at)}
          >
            {t('callTime.bookThis')}
          </Button>
        ) : (
          !calendar.isPending && another
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 lg:-mt-1.5">
          {(offer?.at || calendar.isPending) && another}
          <CallRequestButton
            label={t('callTime.free')}
            className="inline-flex min-h-11 items-center text-[13px] text-text-2 underline decoration-line-2 underline-offset-4"
            phone={access.phone}
            topic="admission"
            page="home"
            reason="guest"
          />
        </div>
      </div>
      <p className="m-0 px-5 pt-3.5 pb-4 text-xs leading-7 text-text-2 shadow-[inset_0_1px_0_var(--hair)] lg:hidden">
        {t('callTime.after')}
      </p>
      <BookingDialog
        open={booking}
        onClose={() => setBooking(false)}
        initial={offer ? { mode: offer.type.mode, type: offer.type.id } : undefined}
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
