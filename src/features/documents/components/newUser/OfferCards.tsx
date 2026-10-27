import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { FileDrop } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { REVIEW_TYPES } from '@/lib/applicant/journey';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';
import { useStartWriting, type WritingOffer } from '../../offers';
import { useReviewUpload } from './useReviewUpload';

type OfferState = 'none' | 'draft' | 'paid' | 'writing' | 'ready';
const TONE: Record<OfferState, ChipTone> = {
  none: 'neutral',
  draft: 'warn',
  paid: 'info',
  writing: 'info',
  ready: 'good',
};
// The drawn page's colours: each service its own, from the theme's tints.
const BAND = { sop: 'bg-luxe', cv: 'bg-tint', recommendation: 'bg-info-tint' } as const;
const INK = { sop: 'bg-primary', cv: 'bg-hero-current', recommendation: 'bg-info' } as const;

function stateOf(offer: WritingOffer): OfferState {
  const { order } = offer;
  if (!order) return 'none';
  if (!order.paid) return 'draft';
  return order.step === 'form' ? 'paid' : order.step;
}

/**
 * "What you don't have, we write": the SOP, CV and recommendation, each a card with a drawn page
 * (something you get), one line on it, a customer's voice about it, the price and "start the form
 * now, pay at its final submit". Someone who has the document uploads it instead.
 */
export function OfferCards({ offers }: { offers: WritingOffer[] }) {
  const { t } = useTranslation('documents');
  if (offers.length === 0) return null;
  return (
    <section aria-labelledby="docs-write" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="docs-write" className="m-0 font-display text-[22px] font-black lg:text-2xl">
            {t('newUser.write.title')}
          </h2>
          <p className="m-0 max-w-[640px] text-sm leading-7 text-text-2">
            {t('newUser.write.subtitle')}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-good-tint px-3.5 py-1.5 text-[13px] font-bold text-good">
          <Icon name="check" size={16} />
          {t('newUser.write.badge')}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {offers.map((offer) => (
          <OfferCard key={offer.kind} offer={offer} />
        ))}
      </div>
    </section>
  );
}

function OfferCard({ offer }: { offer: WritingOffer }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const navigate = useNavigate();
  const start = useStartWriting();
  const upload = useReviewUpload();
  const { kind, testimonial } = offer;
  const name = t(`writing.name.${kind}`);
  const state = stateOf(offer);
  const toman = (value: number) => t('newUser.write.toman', { amount: f.number(value) });
  const featured = kind === 'sop';

  return (
    <article
      aria-labelledby={`offer-${kind}`}
      className={`flex flex-col overflow-hidden rounded-[28px] bg-surface shadow-panel ${
        featured ? 'outline-2 outline-primary outline-solid' : ''
      }`}
    >
      <div aria-hidden="true" className={`flex justify-center px-6 pt-6 ${BAND[kind]}`}>
        <div className="flex w-[70%] flex-col gap-[7px] rounded-t-[14px] bg-surface px-[18px] pt-[18px] pb-2.5 shadow-panel">
          <span className="h-[9px] w-[55%] rounded-full bg-text" />
          <span className={`h-1.5 w-[35%] rounded-full ${INK[kind]}`} />
          <span className="mt-1.5 h-[5px] w-full rounded-full bg-track" />
          <span className="h-[5px] w-[92%] rounded-full bg-track" />
          <span className="h-[5px] w-[96%] rounded-full bg-track" />
          <span className="h-[5px] w-[70%] rounded-full bg-track" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-6 pt-5 pb-6">
        <div className="flex items-center justify-between gap-2">
          <h3 id={`offer-${kind}`} className="m-0 font-display text-xl font-black">
            {name}
          </h3>
          <Chip tone={TONE[state]} small>
            {t(`newUser.write.state.${state}`)}
          </Chip>
        </div>
        <p className="m-0 text-sm leading-7 text-text-2">{t(`newUser.write.pitch.${kind}`)}</p>

        {testimonial && (
          <figure className="m-0 flex flex-col gap-2 rounded-2xl bg-canvas p-3">
            <figcaption className="text-[13px] font-semibold">
              {t('newUser.write.voice', { name: testimonial.name })}
            </figcaption>
            {testimonial.audio ? (
              <audio
                controls
                preload="none"
                src={safeHref(testimonial.audio)}
                aria-label={t('newUser.write.voice', { name: testimonial.name })}
                className="h-11 w-full"
              />
            ) : (
              testimonial.video && (
                <video
                  controls
                  preload="none"
                  src={safeHref(testimonial.video)}
                  poster={testimonial.poster ? safeHref(testimonial.poster) : undefined}
                  aria-label={t('newUser.write.voice', { name: testimonial.name })}
                  className="aspect-video w-full rounded-xl bg-hero"
                />
              )
            )}
          </figure>
        )}

        {state === 'none' || state === 'draft' ? (
          <div className="mt-auto flex flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-[22px] font-black">{toman(offer.price)}</span>
              <span className="text-[13px] text-text-2">{t('newUser.write.priceNote')}</span>
            </span>
            {offer.old_price !== null && (
              <span className="text-[13px] text-text-2">
                <s>{toman(offer.old_price)}</s>
                {offer.discount_ends_at &&
                  ` · ${t('newUser.write.discountEnds', { date: f.dateShort(offer.discount_ends_at) })}`}
              </span>
            )}
          </div>
        ) : (
          <span className="mt-auto text-[13px] text-text-2">
            {t(`newUser.write.note.${state}`)}
          </span>
        )}

        {state === 'none' ? (
          <Button
            variant={featured ? 'primary' : 'dark'}
            className="w-full"
            disabled={start.isPending}
            onClick={() =>
              start.mutate(kind, {
                onSuccess: () => void navigate(`/documents/${kind}`),
                onError: () => toast.error(t('newUser.write.startError')),
              })
            }
          >
            {t('newUser.write.start', { name })}
          </Button>
        ) : (
          <Link
            to={`/documents/${kind}`}
            className={buttonClass(state === 'draft' ? 'primary' : 'outline', 'w-full')}
          >
            {t(state === 'draft' ? 'newUser.write.continue' : 'newUser.write.view')}
          </Link>
        )}
        {state === 'none' && (
          <FileDrop
            id={`offer-file-${kind}`}
            compact
            accept={REVIEW_TYPES}
            disabled={upload.pending}
            chooseLabel={t('newUser.write.haveIt')}
            inputLabel={t('newUser.write.haveItFor', { name })}
            onFile={(file) => upload.send(kind, file)}
          />
        )}
      </div>
    </article>
  );
}
