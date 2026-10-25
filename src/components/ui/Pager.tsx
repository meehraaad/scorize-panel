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
}

/** Footer of a paged list: where you are, previous / next (buttons only when there are pages). */
export function Pager({ status, page, pages, onPage, pending = false, inset = false }: PagerProps) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        inset ? '' : 'px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8'
      }`}
    >
      <span aria-live="polite" className="text-sm text-text-2">
        {status ?? t('pager.page', { page: f.number(page), pages: f.number(pages) })}
      </span>
      {pages > 1 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 px-4 text-sm"
            disabled={page <= 1 || pending}
            onClick={() => onPage(page - 1)}
          >
            {t('pager.previous')}
          </Button>
          <Button
            variant="outline"
            className="h-11 px-4 text-sm"
            disabled={page >= pages || pending}
            onClick={() => onPage(page + 1)}
          >
            {t('pager.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
