import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { useBookSlot } from '@/lib/applicant/booking';
import type { StartOffers } from '@/lib/applicant/journey';
import { useFormat } from '@/lib/i18n/useFormat';

type Offer = NonNullable<StartOffers['consultation']>;

/**
 * The consultation's nearest free times, its price and "book": one tap to the bank gateway (or
 * straight to the session, when credit pays it). A time taken meanwhile: the times are read again.
 * Design: "Scorize New User Dashboard v2" canvas, Main (consult path) and AfterUpload.
 */
export function ConsultSlots({ offer }: { offer: Offer }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const book = useBookSlot({
    booked: t('slots.booked'),
    taken: t('slots.taken'),
    error: t('slots.error'),
  });
  const [picked, setPicked] = useState<string | null>(offer.slots[0] ?? null);
  const slot = picked && offer.slots.includes(picked) ? picked : (offer.slots[0] ?? null);
  const label = (value: string) => `${f.weekday(value)} ${f.time(value)}`;
  const toman = (amount: number) => t('slots.toman', { amount: f.number(amount) });

  return (
    <div className="flex flex-col gap-3">
      {offer.slots.length > 0 ? (
        <ChoiceGroup
          legend={t('slots.legend')}
          options={offer.slots.map((value) => ({ value, label: label(value) }))}
          value={slot}
          onChange={setPicked}
        />
      ) : (
        <p className="m-0 text-sm leading-7 text-text-2">{t('slots.none')}</p>
      )}
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-text-2">
        {t('slots.price')}
        <span className="text-base font-bold text-text">{toman(offer.price)}</span>
        {offer.full_price !== null && <s className="text-[13px]">{toman(offer.full_price)}</s>}
      </p>
      {slot && (
        <Button
          size="lg"
          className="w-full"
          disabled={book.pending}
          onClick={() => book.submit(offer.type, slot)}
        >
          {t('slots.book', { time: label(slot) })}
        </Button>
      )}
    </div>
  );
}
