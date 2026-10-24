import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageColumns } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { applyQuery, type ApplyFile } from './api';
import { useCustomerId } from './useCustomerId';

const TONE: Record<ApplyFile['applications'][number]['status'], ChipTone> = {
  ready: 'warn',
  submitted: 'info',
  accepted: 'good',
  rejected: 'neutral',
};

/** The customer's application file, read-only (crm user_report). The supervisor runs the case. */
export default function CustomerApplyPage() {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const { data } = useSuspenseQuery(applyQuery(useCustomerId()));

  if (!data) return <EmptyState variant="card">{t('apply.none')}</EmptyState>;
  const { contract } = data;
  const rows = [
    { key: 'status', value: contract.active ? t('apply.active') : t('apply.ended') },
    { key: 'features', value: f.list(contract.features.map((item) => t(`apply.feature.${item}`))) },
    {
      key: 'period',
      value: t('apply.period', { start: f.date(contract.start), end: f.date(contract.end) }),
    },
    {
      key: 'degree',
      value: `${tc(`degree.${contract.degree}`)} · ${f.list(contract.countries)}`,
    },
    { key: 'supervisors', value: f.list(contract.supervisors) },
    { key: 'consultant', value: contract.consultant ?? t('due.none') },
  ] as const;

  return (
    <>
      <Notice tone="info">{t('apply.readOnly')}</Notice>
      <StatGrid
        label={t('apply.stats')}
        stats={[
          { label: t('apply.fileStatus'), value: data.status },
          {
            label: t('apply.applies'),
            value: f.number(data.applies.used),
            unit: t('apply.of', { n: f.number(data.applies.total) }),
          },
          { label: t('apply.admissions'), value: f.number(data.admissions), tone: 'good' },
          {
            label: t('apply.emails'),
            value: f.number(data.emails.sent),
            unit: t('apply.of', { n: f.number(data.emails.total) }),
          },
        ]}
      />
      <PageColumns
        asideLabel={t('apply.contract')}
        main={
          <SectionCard id="apply-applications" title={t('apply.applications')}>
            {data.applications.length === 0 ? (
              <EmptyState>{t('apply.noApplications')}</EmptyState>
            ) : (
              <ul className="m-0 list-none p-0 pb-2">
                {data.applications.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
                  >
                    <span className="flex flex-col gap-1">
                      <span dir="ltr" className="text-start text-[15px] font-semibold">
                        {item.university}
                      </span>
                      <span className="text-[13px] text-text-2">
                        <span dir="ltr">{item.program}</span> ·{' '}
                        {item.fee_paid ? t('apply.feePaid') : t('apply.feeUnpaid')}
                      </span>
                    </span>
                    <Chip tone={TONE[item.status]} small>
                      {t(`apply.status.${item.status}`)}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        }
        aside={
          <SectionCard
            id="apply-contract"
            variant="panel"
            title={t('apply.contract')}
            end={
              contract.file_url && (
                <a href={contract.file_url} className="text-sm text-primary-text">
                  {t('apply.download')}
                </a>
              )
            }
          >
            <dl className="m-0 flex flex-col gap-2.5">
              {rows.map((row) => (
                <div key={row.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="flex-none text-text-2">{t(`apply.row.${row.key}`)}</dt>
                  <dd className="m-0 text-end font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        }
      />
    </>
  );
}
