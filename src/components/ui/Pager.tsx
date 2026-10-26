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
  inset = false,
  onHero = false,
}: PagerProps) {
  const { t } = useTranslation();
  const f = useFormat();
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
      className={`flex items-center justify-between gap-3 ${
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
        <div className="flex gap-2">
          {button(t('pager.previous'), page <= 1 || pending, page - 1)}
          {button(t('pager.next'), page >= pages || pending, page + 1)}
        </div>
      )}
    </div>
  );
}
