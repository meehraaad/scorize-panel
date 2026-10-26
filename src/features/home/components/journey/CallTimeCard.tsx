import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Icon } from '@/components/ui/Icon';
import { SlotPicker } from '@/components/ui/SlotPicker';
import {
  CALL_TIMES,
  useCallRequest,
  type ApplicantAccess,
  type CallTime,
} from '@/lib/applicant/access';
import {
  FIRST_SLOT_DAYS,
  firstSlotsQuery,
  freeSlotsQuery,
  type StartOffers,
} from '@/lib/applicant/journey';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useBookSlot } from './useBookSlot';

const DAY = 86_400_000;
/** How far ahead the calendar goes. */
const AHEAD_DAYS = 120;

/**
 * "Rather talk?": the consultation booked on a calendar (its free days and times, the price,
 * "book"), with a free call as the smaller way. Without a consultation on offer, the call alone.
 */
export function TalkCard({ access, offers }: { access: ApplicantAccess; offers: StartOffers }) {
  const offer = offers.consultation;
  if (!offer || !ON_SERVER.consultationSlots) return <CallTimeCard access={access} />;
  return <BookTalkCard access={access} offer={offer} />;
}

type Offer = NonNullable<StartOffers['consultation']>;

function BookTalkCard({ access, offer }: { access: ApplicantAccess; offer: Offer }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const book = useBookSlot();
  const [now] = useState(() => Date.now());
  const day = (offset: number) => toValue(new Date(now + offset * DAY), false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const first = useQuery(firstSlotsQuery(now));
  // A month past the first read: its own read.
  const later = range !== null && range.to > day(FIRST_SLOT_DAYS);
  const month = useQuery({ ...freeSlotsQuery(range?.from ?? '', range?.to ?? ''), enabled: later });
  const slots = [...(first.data?.slots ?? []), ...(later ? (month.data?.slots ?? []) : [])];
  const toman = (amount: number) => t('slots.toman', { amount: f.number(amount) });

  return (
    <Card aria-labelledby="journey-call" className="flex flex-col gap-5 p-5 lg:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="journey-call" className="m-0 text-lg font-bold">
          {t('callTime.title')}
        </h2>
        <p className="m-0 text-sm leading-6 text-text-2">
          {t('callTime.book', { title: offer.title })}
        </p>
      </div>
      {first.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas p-4">
          <p className="m-0 text-sm leading-6 text-text-2">{t('callTime.error')}</p>
          <Button variant="outline" onClick={() => void first.refetch()}>
            {t('callTime.retry')}
          </Button>
        </div>
      ) : (
        <SlotPicker
          label={t('callTime.pick')}
          slots={slots}
          value={slot}
          onChange={setSlot}
          minutes={offer.minutes}
          loading={first.isPending || (later && month.isPending)}
          onMonthChange={setRange}
          until={day(AHEAD_DAYS)}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-hair pt-4">
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-text-2">
          {t('slots.price')}
          <span className="text-base font-bold text-text">{toman(offer.price)}</span>
          {offer.full_price !== null && <s className="text-[13px]">{toman(offer.full_price)}</s>}
        </p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <CallRequestButton
            label={t('callTime.free')}
            className={buttonClass('outline', 'flex-1 sm:flex-none')}
            phone={access.phone}
            topic="admission"
            page="home"
            reason="guest"
          />
          <Button
            className="flex-1 sm:flex-none"
            disabled={!slot || book.pending}
            onClick={() => slot && book.submit(offer.type, slot)}
          >
            {slot ? t('callTime.bookAt', { time: f.time(slot) }) : t('callTime.pickFirst')}
          </Button>
        </div>
      </div>
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
