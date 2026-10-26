import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { sessionSummariesQuery } from './api';

export function SessionSummariesCard({ reservation }: { reservation?: number }) {
  const { t } = useTranslation('consultations');
  const f = useFormat();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    sessionSummariesQuery(reservation),
  );
  const summaries = data.pages.flatMap((page) => page.results);

  return (
    <SectionCard
      id="session-summaries"
      title={t('summaries.title')}
      subtitle={t('summaries.subtitle')}
    >
      {summaries.length === 0 ? (
        <EmptyState>{t('summaries.empty')}</EmptyState>
      ) : (
        <ol className="m-0 list-none p-0">
          {summaries.map((summary) => (
            <li
              key={summary.id}
              className="flex flex-col gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-text-2">
                <span>{[summary.kind, ...summary.authors].join(' · ')}</span>
                <time dateTime={summary.at}>
                  {f.date(summary.at)} · {f.time(summary.at)}
                </time>
              </div>
              <p className="m-0 text-[15px] leading-8 break-words whitespace-pre-wrap">
                {summary.customer_summary}
              </p>
              {reservation === undefined && summary.reservation !== null && (
                <Link
                  to={`/consultations/${String(summary.reservation)}`}
                  className={buttonClass('outline', 'self-start')}
                >
                  {t('summaries.booking')}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
      {hasNextPage && (
        <Button
          variant="outline"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {t('summaries.more')}
        </Button>
      )}
    </SectionCard>
  );
}
