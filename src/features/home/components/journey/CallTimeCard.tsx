import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import consultation from '@/assets/journey/consultation.svg';
import { BookingDialog } from '@/components/applicant/booking/BookingDialog';
import { preloadBooking } from '@/components/applicant/booking/preload';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
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
  CONSULTATION_MODES,
  firstCalendarQuery,
  useBookSlot,
  type BookableType,
  type BookingCalendar,
  type ConsultationMode,
} from '@/lib/applicant/booking';
import { weekStart } from '@/lib/calendar';
import { useCalendar } from '@/lib/i18n/useCalendar';
import { useFormat } from '@/lib/i18n/useFormat';
import type { StartOffers } from '@/lib/applicant/journey';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { toast } from '@/lib/toast';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';

/**
 * "Rather talk?": a consultation, online or in person, each with its first free time; one tap
 * books it (off to the bank gateway), "other times" opens the booking calendar on that choice, and
 * a free call is the smaller way. Without a consultation on offer, the call alone.
 * Design: "Mobile Quiz Card Mockups" canvas, the consultation row.
 */
export function TalkCard({ access, offers }: { access: ApplicantAccess; offers: StartOffers }) {
  if (!offers.consultation || !ON_SERVER.bookingCalendar) return <CallTimeCard access={access} />;
  return <BookTalkCard access={access} />;
}

/** A mode's first free time from now on, with its consultation. */
interface First {
  mode: ConsultationMode;
  type: BookableType;
  at: string | null;
}

/** Per mode on offer: the soonest time with a seat in the calendar's first read. */
function firstTimes(calendar: BookingCalendar | undefined, now: number): First[] {
  if (!calendar) return [];
  return CONSULTATION_MODES.flatMap((mode) => {
    const types = calendar.types.filter((type) => type.mode === mode);
    const [fallback] = types;
    if (!fallback) return [];
    const slot = calendar.slots
      .filter(
        (item) =>
          item.left > 0 && Date.parse(item.at) > now && types.some((type) => type.id === item.type),
      )
      .sort((x, y) => Date.parse(x.at) - Date.parse(y.at))[0];
    const type = (slot && types.find((item) => item.id === slot.type)) ?? fallback;
    return [{ mode, type, at: slot?.at ?? null }];
  });
}

function BookTalkCard({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const cal = useCalendar();
  // The links close the intro beside the choices on desktop, the card on phones.
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [now] = useState(() => new Date());
  // Listed in the home route's data; still a plain read, so a slow calendar never holds up the home.
  const calendar = useQuery(firstCalendarQuery(weekStart(cal.kind), now));
  const firsts = firstTimes(calendar.data, now.getTime());
  const [picked, setPicked] = useState<ConsultationMode | null>(null);
  const chosen = firsts.find((item) => item.mode === picked) ?? firsts.find((item) => item.at);
  const book = useBookSlot({
    booked: t('slots.booked'),
    taken: t('slots.taken'),
    error: t('slots.error'),
  });
  const when = (at: string) => t('callTime.when', { day: f.weekday(at), time: f.time(at) });
  const toman = (amount: number) => t('slots.toman', { amount: f.number(amount) });
  const [booking, setBooking] = useState(false);
  const discount =
    chosen?.type.full_price && chosen.type.full_price > chosen.type.price
      ? Math.round((1 - chosen.type.price / chosen.type.full_price) * 100)
      : 0;

  const links = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        aria-haspopup="dialog"
        onPointerEnter={preloadBooking}
        onFocus={preloadBooking}
        onClick={() => setBooking(true)}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary-text"
      >
        {t('callTime.other')}
        <Icon name="chevronEnd" size={14} />
      </button>
      <CallRequestButton
        label={t('callTime.free')}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-text-2"
        phone={access.phone}
        topic="admission"
        page="home"
        reason="guest"
      />
    </div>
  );

  return (
    <Card
      aria-labelledby="journey-call"
      className="flex flex-col shadow-[var(--panel-shadow),var(--path-shadow)] lg:flex-row"
    >
      <div className="h-30 flex-none lg:order-last lg:h-auto lg:w-60">
        <img src={consultation} alt="" className="block size-full object-cover" />
      </div>
      <div className="flex min-w-0 flex-col gap-4 p-5 lg:flex-1 lg:p-8">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-primary-text">
            {chosen
              ? t('callTime.kickerMinutes', { n: f.number(chosen.type.minutes) })
              : t('callTime.kicker')}
          </span>
          <h2
            id="journey-call"
            className="m-0 font-display text-[19px] leading-relaxed font-bold lg:text-2xl"
          >
            {t('callTime.title')}
          </h2>
          <p className="m-0 text-sm leading-7 text-text-2">{t('callTime.book')}</p>
        </div>
        {desktop && <div className="mt-auto">{links}</div>}
      </div>
      <div className="flex min-w-0 flex-col gap-4 px-5 pb-4 lg:flex-[1.2] lg:bg-canvas/50 lg:p-8 lg:shadow-[inset_1px_0_0_var(--hair)] rtl:lg:shadow-[inset_-1px_0_0_var(--hair)]">
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-2.5 p-0 text-[13px] font-semibold text-text-2">
            {t('callTime.how')}
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {calendar.isPending
              ? CONSULTATION_MODES.map((mode) => (
                  <Bone key={mode} className="h-36 rounded-[20px]!" />
                ))
              : firsts.map((item) => {
                  const on = item.mode === chosen?.mode;
                  return (
                    <label
                      key={item.mode}
                      className={`relative flex cursor-pointer flex-col gap-2.5 rounded-[20px] p-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
                        on
                          ? 'bg-tint shadow-[inset_0_0_0_2px_var(--primary)]'
                          : 'bg-surface shadow-[inset_0_0_0_1px_var(--line-2)]'
                      } ${item.at ? '' : 'opacity-70'}`}
                    >
                      <input
                        type="radio"
                        name="journey-mode"
                        className="sr-only"
                        checked={on}
                        disabled={!item.at}
                        onChange={() => setPicked(item.mode)}
                      />
                      <span
                        aria-hidden="true"
                        className={`absolute end-3 top-3 flex size-5.5 items-center justify-center rounded-full ${
                          on
                            ? 'bg-primary text-on-primary'
                            : 'shadow-[inset_0_0_0_1.5px_var(--line-3)]'
                        }`}
                      >
                        {on && <Icon name="check" size={12} />}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex size-11 items-center justify-center rounded-[14px] bg-path-sand ${
                          item.mode === 'online' ? 'text-path-sea' : 'text-path-sun'
                        }`}
                      >
                        <Icon name={item.mode === 'online' ? 'video' : 'building'} size={22} />
                      </span>
                      <span className="text-base font-bold">
                        {t(`callTime.modes.${item.mode}.title`)}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-xs text-text-2">
                          {item.at ? t('callTime.first') : t('callTime.none')}
                        </span>
                        {item.at && (
                          <span
                            className={`text-sm font-bold ${on ? 'text-primary-text' : 'text-text'}`}
                          >
                            {when(item.at)}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
          </div>
        </fieldset>
        {calendar.isError && (
          <p className="m-0 text-sm leading-6 text-text-2">{t('callTime.error')}</p>
        )}
        <div className="mt-auto flex flex-col gap-2.5 pt-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:flex-row lg:items-center lg:gap-4 lg:pt-0 lg:shadow-none">
          {chosen && (
            <p className="m-0 flex flex-1 flex-wrap items-baseline justify-between gap-2 text-[13px] text-text-2">
              <span className="inline-flex items-center gap-2">
                {t('slots.price')}
                {discount > 0 && (
                  <Chip tone="good" small>
                    {t('callTime.discount', { n: f.number(discount) })}
                  </Chip>
                )}
              </span>
              <span className="inline-flex items-baseline gap-2">
                {chosen.type.full_price !== null && <s>{toman(chosen.type.full_price)}</s>}
                <span className="font-display text-lg font-bold text-text">
                  {toman(chosen.type.price)}
                </span>
              </span>
            </p>
          )}
          {chosen?.at ? (
            <Button
              size="lg"
              className="max-lg:w-full"
              disabled={book.pending}
              onClick={() => chosen.at && book.submit(chosen.type.id, chosen.at)}
            >
              {t('callTime.bookAt', {
                mode: t(`callTime.modes.${chosen.mode}.title`),
                time: when(chosen.at),
              })}
            </Button>
          ) : (
            !calendar.isPending && (
              <Button
                size="lg"
                className="max-lg:w-full"
                aria-haspopup="dialog"
                onPointerEnter={preloadBooking}
                onFocus={preloadBooking}
                onClick={() => setBooking(true)}
              >
                {t('callTime.other')}
              </Button>
            )
          )}
          {!desktop && links}
        </div>
      </div>
      <BookingDialog
        open={booking}
        onClose={() => setBooking(false)}
        initial={chosen ? { mode: chosen.mode, type: chosen.type.id } : undefined}
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
