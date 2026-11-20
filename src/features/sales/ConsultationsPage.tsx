import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { FilterTabs } from '@/components/ui/Filters';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { Pager } from '@/components/ui/Pager';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { toValue } from '@/lib/calendar';
import { useFormat } from '@/lib/i18n/useFormat';
import { consultationsQuery, type ConsultationRange } from './api';
import { ConsultationCalendar } from './components/ConsultationCalendar';
import { ConsultationDays } from './components/ConsultationDays';
import { DaySummary } from './components/DaySummary';

const RANGES: readonly Exclude<ConsultationRange, 'span'>[] = [
  'today',
  'week',
  'past',
  'all',
  'day',
];
type View = 'week' | 'list';
const VIEWS: readonly View[] = ['week', 'list'];

/**
 * Consultations assigned to the seller: a week calendar (with the timed follow-ups), or the list
 * by day where past ones without a logged session stand out.
 */
export default function ConsultationsPage() {
  const { t } = useTranslation('sales');
  const [view, setView] = useState<View>('week');
  const switcher = (
    <FilterTabs
      label={t('consultationCalendar.views')}
      value={view}
      onChange={setView}
      options={VIEWS.map((value) => ({ value, label: t(`consultationCalendar.${value}`) }))}
    />
  );
  if (view === 'week')
    return (
      <PageStack>
        <PageHeader
          title={t('consultations.title')}
          subtitle={t('consultations.subtitle')}
          actions={switcher}
        />
        <ConsultationCalendar />
      </PageStack>
    );
  return <ConsultationsList switcher={switcher} />;
}

/** The list view: a range, a type, only unlogged; by day, a page at a time. */
function ConsultationsList({ switcher }: { switcher: ReactNode }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [range, setRange] = useState<Exclude<ConsultationRange, 'span'>>('week');
  const [type, setType] = useState('all');
  const [unlogged, setUnlogged] = useState(false);
  const [page, setPage] = useState(1);
  // One chosen day (`day` range), and a manager's seller.
  const [day, setDay] = useState(() => toValue(new Date(), false));
  const [seller, setSeller] = useState('all');
  const filters = {
    ...(range === 'day' && day ? { date: day } : {}),
    ...(seller === 'all' ? {} : { seller: seller === 'none' ? ('none' as const) : Number(seller) }),
  };
  const { data, isPlaceholderData } = useQuery(
    consultationsQuery(range, type === 'all' ? null : Number(type), unlogged, page, filters),
  );
  const pages = pagesOf(data);
  useClampPage(data, page, setPage);

  return (
    <PageStack>
      <PageHeader
        title={t('consultations.title')}
        subtitle={
          data && data.unlogged > 0
            ? `${t('consultations.subtitle')} ${t('consultations.unlogged', { n: f.number(data.unlogged) })}`
            : t('consultations.subtitle')
        }
        actions={switcher}
      />
      <div className="flex flex-wrap items-center gap-2.5">
        <FilterTabs
          label={t('consultations.range')}
          value={range}
          onChange={(value) => {
            setRange(value);
            setPage(1);
          }}
          options={RANGES.map((value) => {
            const count = value === 'day' ? data?.counts.day : data?.counts[value];
            return {
              value,
              label: t(`consultations.rangeOption.${value}`),
              ...(count === undefined ? {} : { count: f.number(count) }),
            };
          })}
        />
        {data?.sellers && data.sellers.length > 0 && (
          <SelectField
            inline
            label={t('consultations.seller')}
            value={seller}
            onChange={(value) => {
              setSeller(value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: t('consultations.allSellers') },
              { value: 'none', label: t('consultations.noSeller') },
              ...data.sellers.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        )}
        <SelectField
          inline
          label={t('consultations.type')}
          value={type}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('consultations.allTypes') },
            ...(data?.types ?? []).map((item) => ({ value: String(item.id), label: item.name })),
          ]}
        />
        <TogglePill
          label={t('consultations.unloggedOnly')}
          checked={unlogged}
          onChange={(value) => {
            setUnlogged(value);
            setPage(1);
          }}
        />
      </div>

      {range === 'day' && (
        <div className="max-w-xs">
          <LazyDatePicker
            label={t('consultations.day')}
            value={day}
            onChange={(value) => {
              setDay(value);
              setPage(1);
            }}
          />
        </div>
      )}
      {range === 'day' && data?.day && <DaySummary report={data.day} />}

      {!data ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : (
        <ConsultationDays
          items={data.results}
          sellers={data.sellers}
          empty={t('consultations.empty')}
        />
      )}
      {pages > 1 && (
        <Card>
          <Pager page={page} pages={pages} pending={isPlaceholderData} onPage={setPage} />
        </Card>
      )}
    </PageStack>
  );
}
