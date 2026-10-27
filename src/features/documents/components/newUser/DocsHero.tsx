import { useTranslation } from 'react-i18next';
import { FileDrop } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';
import { REVIEW_TYPES, type ReviewKind } from '@/lib/applicant/journey';
import { useReviewUpload } from './useReviewUpload';

/**
 * One promise and one action, on the contract's premium hero (bg-luxe): send your documents, an
 * advisor calls. The drop zone takes the next document the review needs most.
 */
export function DocsHero({ next }: { next: ReviewKind }) {
  const { t } = useTranslation('documents');
  const { send, pending } = useReviewUpload();
  const nextName = t(`review.kinds.${next}`);

  return (
    <section
      aria-labelledby="docs-hero-title"
      className="flex flex-wrap items-center gap-x-14 gap-y-10 rounded-[28px] px-6 py-10 text-on-hero shadow-luxe bg-luxe lg:rounded-[36px] lg:p-14"
    >
      <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
        <span className="self-start rounded-full px-3.5 py-1 text-[13px] font-extrabold bg-luxe-gold">
          {t('newUser.hero.badge')}
        </span>
        <h2
          id="docs-hero-title"
          className="m-0 font-display text-[28px] leading-[1.5] font-black lg:text-[36px]"
        >
          {t('newUser.hero.title')}
        </h2>
        <p className="m-0 text-base text-on-luxe-2">{t('newUser.hero.text')}</p>
      </div>

      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
        <div className="rounded-[24px] bg-surface p-2 text-text ring-1 ring-(--luxe-gold)">
          <FileDrop
            id="docs-hero-file"
            accept={REVIEW_TYPES}
            disabled={pending}
            chooseLabel={t('review.choose')}
            inputLabel={t('review.chooseFor', { kind: nextName })}
            hint={t('review.dropHint')}
            touchHint={t('review.dropHintTouch')}
            onFile={(file) => send(next, file)}
          />
        </div>
        <span className="flex items-center justify-center gap-2 text-[13px] text-on-luxe-2">
          <Icon name="shield" size={16} />
          {t('newUser.hero.private')}
        </span>
      </div>
    </section>
  );
}
