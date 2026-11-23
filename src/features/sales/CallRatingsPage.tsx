import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { callRatingsQuery, type RatingScope, type RatingStats } from '@/lib/sales/callRatings';

type RatingRow = RatingStats & { id: string | number; label: ReactNode };

export default function CallRatingsPage() {
  const scope: RatingScope = useMatch('/sales/manager/phone/ratings') ? 'team' : 'mine';
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(callRatingsQuery(scope));
  const average = data.total.average;
  return (
    <PageStack>
      <PageHeader title={t(`callRatings.${scope}`)} subtitle={t('callRatings.period')} />
      <SectionCard id="call-ratings-overview" title={t('callRatings.overview')} variant="panel">
        <dl className="m-0 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-body text-text-2">{t('callRatings.responseCount')}</dt>
            <dd className="m-0 text-title font-bold">{f.number(data.total.count)}</dd>
          </div>
          <div>
            <dt className="text-body text-text-2">{t('callRatings.average')}</dt>
            <dd className="m-0 text-title font-bold">
              {average === null ? '—' : f.number(Math.round(average * 10) / 10)}
            </dd>
          </div>
        </dl>
        {data.total.count === 0 && (
          <p className="m-0 text-body text-text-2">{t('callRatings.empty')}</p>
        )}
      </SectionCard>
      {data.queues.length > 0 && (
        <RatingsTable
          id="call-ratings-queues"
          title={t('callRatings.queues')}
          column={t('callRatings.queue')}
          rows={data.queues.map((row) => ({ ...row, id: row.queue, label: f.number(row.queue) }))}
        />
      )}
      {scope === 'team' && data.agents.length > 0 && (
        <RatingsTable
          id="call-ratings-agents"
          title={t('callRatings.agents')}
          column={t('callRatings.agent')}
          rows={data.agents.map((row) => ({
            ...row,
            id: `${row.queue}-${row.staff_id ?? ''}-${row.extension ?? ''}`,
            label: (
              <>
                {row.agent ??
                  (row.extension === null ? t('callRatings.unknown') : f.number(row.extension))}
                <span className="ms-2 text-text-2">{f.number(row.queue)}</span>
              </>
            ),
          }))}
        />
      )}
    </PageStack>
  );
}

function RatingsTable({
  id,
  title,
  column,
  rows,
}: {
  id: string;
  title: string;
  column: string;
  rows: RatingRow[];
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  return (
    <SectionCard id={id} title={title} variant="panel">
      <table className="w-full text-body">
        <thead>
          <tr className="text-text-2">
            <th scope="col" className="py-2 text-start">
              {column}
            </th>
            <th scope="col" className="py-2 text-start">
              {t('callRatings.responseCount')}
            </th>
            <th scope="col" className="py-2 text-start">
              {t('callRatings.average')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-line border-t">
              <th scope="row" className="py-2 text-start font-medium">
                {row.label}
              </th>
              <td className="py-2">{f.number(row.count)}</td>
              <td className="py-2">
                {row.average === null ? '—' : f.number(Math.round(row.average * 10) / 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}
