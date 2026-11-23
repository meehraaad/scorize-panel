import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { CaseContract, CaseInstallments } from '@/features/supervisor/CaseOverviewPage';
import { useFormat, TOMAN } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import { financeQuery, type CustomerPayment, type CustomerWorkspace } from './api';

export default function CustomerContractPage() {
  const workspace = useOutletContext<CustomerWorkspace>();
  return workspace.case ? <CustomerContract workspace={workspace} /> : null;
}

function CustomerContract({ workspace }: { workspace: CustomerWorkspace }) {
  const { data } = useSuspenseQuery(financeQuery(workspace.id));
  const { case: file } = workspace;
  if (!file) return null;
  return (
    <PageStack>
      <CaseContract data={file} />
      <CaseInstallments data={file} />
      <PaymentList kind="payments" rows={data.payments} />
      <PaymentList kind="purchases" rows={data.purchases} />
    </PageStack>
  );
}

function PaymentList({ kind, rows }: { kind: 'payments' | 'purchases'; rows: CustomerPayment[] }) {
  const { t } = useTranslation(['executive', 'sales']);
  const f = useFormat();
  return (
    <SectionCard id={kind} title={t(`workspace.${kind}`)}>
      {rows.length ? (
        <ul className="m-0 list-none divide-y divide-hair p-0">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <span>{row.items.join(' · ') || t('workspace.payment')}</span>
              <span className="text-small text-text-2">{f.date(row.at)}</span>
              <span>{f.money(row.amount, TOMAN)}</span>
              {row.receipt && (
                <a className="text-primary-text underline" href={safeHref(row.receipt)}>
                  {t('workspace.receipt')}
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>{t('workspace.noPayments')}</EmptyState>
      )}
    </SectionCard>
  );
}
