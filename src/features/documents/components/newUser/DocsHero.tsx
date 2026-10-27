import { useTranslation } from 'react-i18next';
import { FileDrop } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { REVIEW_TYPES, type ReviewKind } from '@/lib/applicant/journey';
import type { TrayItem } from './tray';
import { useReviewUpload } from './useReviewUpload';

const STATE_CLASS = {
  done: 'bg-live text-hero',
  started: 'bg-luxe-gold',
  todo: 'bg-hero-raised text-on-hero',
} as const;
const STATE_ICON = { done: 'check', started: 'pen', todo: 'plus' } as const;

/**
 * The tab's promise for someone without a contract, on the contract's premium hero (bg-luxe): send your documents, a consultant reviews them
 * for free. The case's documents as a row of chips (sent, being written, not yet) and a drop zone
 * for the next one that matters most for the review.
 */
export function DocsHero({ tray, next }: { tray: TrayItem[]; next: ReviewKind }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const { send, pending } = useReviewUpload();
  const done = tray.filter((item) => item.state === 'done').length;
  const nextName = t(`review.kinds.${next}`);

  return (
    <section
      aria-labelledby="docs-hero-title"
      className="relative flex flex-wrap items-stretch gap-x-10 gap-y-7 overflow-hidden rounded-[28px] px-5 py-7 text-on-hero shadow-luxe bg-luxe lg:rounded-[36px] lg:px-10 lg:py-10"
    >
      <div className="relative flex min-w-0 flex-[1_1_480px] flex-col gap-4">
        <span className="self-start rounded-full px-3.5 py-1 text-[13px] font-extrabold bg-luxe-gold">
          {t('newUser.hero.badge')}
        </span>
        <h2
          id="docs-hero-title"
          className="m-0 font-display text-[28px] leading-[1.4] font-black lg:text-[38px]"
        >
          {t('newUser.hero.title')}
        </h2>
        <p className="m-0 max-w-[560px] text-base leading-8 text-on-luxe-2 lg:text-[17px]">
          {t('newUser.hero.text')}
        </p>
        <div className="mt-1 flex flex-col gap-2.5">
          <span className="text-[13px] text-on-luxe-2">
            {t('newUser.hero.count', { done: f.number(done), total: f.number(tray.length) })}
          </span>
          <ul
            aria-label={t('newUser.hero.tray')}
            className="m-0 flex list-none flex-wrap gap-2 p-0"
          >
            {tray.map((item) => (
              <li
                key={item.kind}
                className={`flex items-center gap-1.5 rounded-full py-1.5 ps-2.5 pe-3 text-[13px] font-bold ${STATE_CLASS[item.state]}`}
              >
                <Icon name={STATE_ICON[item.state]} size={14} />
                {t(`review.kinds.${item.kind}`)}
                <span className="sr-only">{t(`newUser.hero.state.${item.state}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="relative flex min-w-0 flex-[1_1_320px] flex-col justify-center gap-3">
        <p className="m-0 text-[15px] font-bold">{t('newUser.hero.next', { kind: nextName })}</p>
        <div className="rounded-[22px] bg-surface p-2 text-text ring-1 ring-(--luxe-gold)">
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
        <span className="flex items-center gap-2 text-[13px] text-on-luxe-2">
          <Icon name="shield" size={16} />
          {t('newUser.hero.private')}
        </span>
      </div>
    </section>
  );
}
