import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import { Button } from './Button';

interface PagerProps {
  /** "7 of 12 applications". Default: "Page 1 of 18". */
  status?: ReactNode;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  pending?: boolean;
  /** Show up to three nearby page numbers between previous and next. */
  numbered?: boolean;
  /** Inside a padded card (`SectionCard variant="panel"`): no padding or divider of its own. */
  inset?: boolean;
  /** On the dark hero card: light text and translucent buttons. */
  onHero?: boolean;
}

const HERO_BUTTON =
  'inline-flex h-11 items-center justify-center rounded-full bg-hero-raised px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:shadow-[inset_0_0_0_1px_var(--on-hero-3)] disabled:opacity-40';

/** Footer of a paged list: where you are, previous / next (buttons only when there are pages). */
export function Pager({
  status,
  page,
  pages,
  onPage,
  pending = false,
  numbered = false,
  inset = false,
  onHero = false,
}: PagerProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const first = Math.max(1, Math.min(page - 1, pages - 2));
  const button = (label: string, disabled: boolean, to: number) =>
    onHero ? (
      <button type="button" className={HERO_BUTTON} disabled={disabled} onClick={() => onPage(to)}>
        {label}
      </button>
    ) : (
      <Button
        variant="outline"
        className="h-11 px-4 text-sm"
        disabled={disabled}
        onClick={() => onPage(to)}
      >
        {label}
      </Button>
    );
  return (
    <div
      className={`flex ${numbered ? 'flex-wrap' : ''} items-center justify-between gap-3 ${
        inset
          ? ''
          : `px-5 py-4 ${
              onHero
                ? 'shadow-[inset_0_1px_0_var(--hero-line)] lg:px-9'
                : 'shadow-[inset_0_1px_0_var(--hair)] lg:px-8'
            }`
      }`}
    >
      <span aria-live="polite" className={`text-sm ${onHero ? 'text-on-hero-2' : 'text-text-2'}`}>
        {status ?? t('pager.page', { page: f.number(page), pages: f.number(pages) })}
      </span>
      {pages > 1 && (
        <div className={`flex gap-2 ${numbered ? 'ms-auto flex-wrap' : ''}`}>
          {button(t('pager.previous'), page <= 1 || pending, page - 1)}
          {numbered &&
            Array.from({ length: Math.min(3, pages) }, (_, index) => {
              const number = first + index;
              const current = number === page;
              return (
                <Button
                  key={number}
                  variant={current ? 'dark' : 'outline'}
                  className="min-w-11 px-2 text-small"
                  aria-current={current ? 'page' : undefined}
                  aria-label={t('pager.goTo', { page: f.number(number) })}
                  disabled={pending}
                  onClick={() => onPage(number)}
                >
                  {f.number(number)}
                </Button>
              );
            })}
          {button(t('pager.next'), page >= pages || pending, page + 1)}
        </div>
      )}
    </div>
  );
}
