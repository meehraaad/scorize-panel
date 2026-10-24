import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pager } from '@/components/ui/Pager';
import { SectionHeading } from '@/components/ui/SectionCard';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TagList } from '@/components/ui/Tags';
import { useFormat } from '@/lib/i18n/useFormat';
import { PROFESSORS_PAGE_SIZE, professorEmailsQuery, type ProfessorEmailStatus } from '../api';

const COLUMNS = 'lg:grid-cols-[minmax(180px,1.4fr)_minmax(140px,1fr)_minmax(240px,2fr)_110px]';

const STATUS_TONE: Record<ProfessorEmailStatus, string> = {
  replied: 'text-good',
  sent: 'text-text-2',
  reminded: 'text-text-2',
};

/**
 * Professors emailed on the applicant's behalf. Loads after the rest of the page and pages on the
 * server: the list can run into hundreds.
 */
export function ProfessorEmails() {
  const { t } = useTranslation('applications');
  const f = useFormat();
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery(
    professorEmailsQuery(page),
  );

  // Nothing sent yet: the section would only say so, so leave it out.
  if (data?.count === 0) return null;

  const pages = data ? Math.max(1, Math.ceil(data.count / PROFESSORS_PAGE_SIZE)) : 1;

  return (
    <section
      aria-labelledby="apps-professors"
      aria-busy={isPending}
      className="flex flex-col gap-4"
    >
      <SectionHeading
        id="apps-professors"
        title={t('professors.title')}
        subtitle={t('professors.subtitle')}
        end={
          data && (
            <dl className="m-0 flex gap-4 text-sm text-text-2">
              {/* dt first for screen readers; shown number first. */}
              <div className="flex flex-row-reverse gap-1">
                <dt>{t('professors.sent')}</dt>
                <dd className="m-0 font-bold text-text">{f.number(data.count)}</dd>
              </div>
              <div className="flex flex-row-reverse gap-1">
                <dt>{t('professors.replied')}</dt>
                <dd className="m-0 font-bold text-good">{f.number(data.replied)}</dd>
              </div>
            </dl>
          )
        }
      />

      <Card>
        {isError && !data ? (
          <EmptyState
            variant="padded"
            action={
              <Button variant="outline" onClick={() => void refetch()}>
                {t('professors.retry')}
              </Button>
            }
          >
            {t('professors.error')}
          </EmptyState>
        ) : !data ? (
          <SkeletonRows rows={PROFESSORS_PAGE_SIZE} />
        ) : data.count === 0 ? (
          <EmptyState
            variant="padded"
            title={t('professors.emptyTitle')}
            icon="send"
            action={
              <Link to="/documents#docs-interests" className={buttonClass('primary')}>
                {t('professors.addInterests')}
              </Link>
            }
          >
            {t('professors.empty')}
          </EmptyState>
        ) : (
          <>
            <div
              aria-hidden="true"
              className={`hidden min-h-12 items-center gap-x-5 px-8 text-[13px] font-medium text-text-2 shadow-[inset_0_-1px_0_var(--hair)] lg:grid ${COLUMNS}`}
            >
              <span>{t('professors.column.university')}</span>
              <span>{t('professors.column.department')}</span>
              <span>{t('professors.column.interests')}</span>
              <span>{t('professors.column.status')}</span>
            </div>
            <ul
              className={`m-0 list-none divide-y divide-hair p-0 transition-opacity ${
                isPlaceholderData ? 'opacity-60' : ''
              }`}
            >
              {data.results.map((email) => (
                <li
                  key={email.id}
                  className={`grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 px-5 py-4 lg:min-h-16 lg:items-center lg:gap-x-5 lg:px-8 lg:py-3.5 ${COLUMNS}`}
                >
                  <bdi className="text-[15px] font-semibold">{email.university}</bdi>
                  <span
                    className={`text-[13px] font-medium lg:order-last ${STATUS_TONE[email.status]}`}
                  >
                    <span className="sr-only">{t('professors.column.status')} </span>
                    {t(`professors.status.${email.status}`)}
                  </span>
                  <span className="col-span-2 text-[13px] text-text-2 lg:col-span-1 lg:text-sm">
                    <span className="sr-only">{t('professors.column.department')} </span>
                    <bdi>{email.department}</bdi>
                  </span>
                  <div className="col-span-2 lg:col-span-1">
                    <TagList
                      label={t('professors.column.interests')}
                      tags={email.interests}
                      tone="neutral"
                      size="sm"
                    />
                  </div>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              pages={pages}
              onPage={setPage}
              pending={isPlaceholderData}
              status={t('professors.page', { page: f.number(page), pages: f.number(pages) })}
            />
          </>
        )}
      </Card>
    </section>
  );
}
