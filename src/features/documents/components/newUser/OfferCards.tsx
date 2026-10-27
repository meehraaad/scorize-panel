import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';
import { useStartWriting, type WritingOffer } from '../../offers';

type OfferState = 'none' | 'draft' | 'paid' | 'writing' | 'ready';

function stateOf(offer: WritingOffer): OfferState {
  const { order } = offer;
  if (!order) return 'none';
  if (!order.paid) return 'draft';
  return order.step === 'form' ? 'paid' : order.step;
}

/**
 * "What you don't have, we write": three quiet cards (name, one line, the price, one button) and a
 * single customer's voice for the whole section. The form opens now; payment is at its final
 * submit.
 */
export function OfferCards({ offers }: { offers: WritingOffer[] }) {
  const { t } = useTranslation('documents');
  if (offers.length === 0) return null;
  const voice = offers.find((offer) => offer.testimonial)?.testimonial;
  return (
    <section aria-labelledby="docs-write" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id="docs-write" className="m-0 font-display text-[22px] font-black">
          {t('newUser.write.title')}
        </h2>
        <p className="m-0 text-sm text-text-2">{t('newUser.write.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {offers.map((offer) => (
          <OfferCard key={offer.kind} offer={offer} />
        ))}
      </div>
      {voice && (voice.audio || voice.video) && (
        <figure className="m-0 mt-2 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[22px] bg-surface px-6 py-4 shadow-panel">
          <figcaption className="flex items-center gap-3 font-bold">
            <span
              aria-hidden="true"
              className="flex size-11 flex-none items-center justify-center rounded-full bg-primary text-on-primary"
            >
              <Icon name="play" size={16} filled />
            </span>
            {t('newUser.write.voice', { name: voice.name })}
          </figcaption>
          {voice.audio ? (
            <audio
              controls
              preload="none"
              src={safeHref(voice.audio)}
              aria-label={t('newUser.write.voice', { name: voice.name })}
              className="h-11 min-w-0 flex-[1_1_260px]"
            />
          ) : (
            voice.video && (
              <video
                controls
                preload="none"
                src={safeHref(voice.video)}
                poster={voice.poster ? safeHref(voice.poster) : undefined}
                aria-label={t('newUser.write.voice', { name: voice.name })}
                className="aspect-video w-full rounded-xl bg-hero"
              />
            )
          )}
        </figure>
      )}
    </section>
  );
}

function OfferCard({ offer }: { offer: WritingOffer }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const navigate = useNavigate();
  const start = useStartWriting();
  const { kind } = offer;
  const name = t(`newUser.write.name.${kind}`);
  const state = stateOf(offer);
  const featured = kind === 'sop';

  return (
    <article
      aria-labelledby={`offer-${kind}`}
      className={`flex flex-col gap-3.5 rounded-[28px] bg-surface px-7 py-8 shadow-panel ${
        featured ? 'outline-[1.5px] outline-primary outline-solid' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id={`offer-${kind}`} className="m-0 font-display text-[19px] font-black">
          {name}
        </h3>
        {state !== 'none' && (
          <span className={`text-xs font-bold ${state === 'draft' ? 'text-warn' : 'text-good'}`}>
            {t(`newUser.write.state.${state}`)}
          </span>
        )}
      </div>
      <p className="m-0 text-sm text-text-2">{t(`newUser.write.pitch.${kind}`)}</p>

      <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
        {state === 'none' || state === 'draft' ? (
          <>
            <span className="font-display text-xl font-black">{f.number(offer.price)}</span>
            <span className="text-[13px] text-text-2">{t('newUser.write.toman')}</span>
            {offer.old_price !== null && (
              <s className="text-[13px] text-text-3">{f.number(offer.old_price)}</s>
            )}
          </>
        ) : (
          <span className="text-[13px] text-text-2">{t(`newUser.write.note.${state}`)}</span>
        )}
      </div>

      {state === 'none' ? (
        <Button
          variant={featured ? 'primary' : 'outline'}
          className="w-full"
          disabled={start.isPending}
          aria-label={t('newUser.write.startFor', { name })}
          onClick={() =>
            start.mutate(kind, {
              onSuccess: () => void navigate(`/documents/${kind}`),
              onError: () => toast.error(t('newUser.write.startError')),
            })
          }
        >
          {t('newUser.write.start')}
        </Button>
      ) : (
        <Link
          to={`/documents/${kind}`}
          className={buttonClass(state === 'draft' ? 'primary' : 'outline', 'w-full')}
        >
          {t(state === 'draft' ? 'newUser.write.continue' : 'newUser.write.view')}
        </Link>
      )}
    </article>
  );
}
