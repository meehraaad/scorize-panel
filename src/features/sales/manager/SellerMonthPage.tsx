import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { idParam } from '@/lib/router/lazyPage';
import { teamQuery, teamSellerQuery } from '../api';
import type { MonthContract } from '../api/month';
import { MonthReport } from '../components/MonthReport';
import { salesPath, sellerMonthPath } from '../paths';
import { MoveContractForm } from './MoveContractForm';

/**
 * One seller's month, as their own «عملکرد» page shows it, opened by the manager from the team
 * page's leaderboard. The manager switches seller and month here, and can move a contract.
 */
export default function SellerMonthPage() {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const f = useFormat();
  const navigate = useNavigate();
  const seller = idParam(useParams().seller);
  const [params, setParams] = useSearchParams();
  const month = params.get('month');
  const { data: team } = useQuery(teamQuery('month'));
  const { data, isError } = useQuery({
    ...teamSellerQuery(seller ?? 0, month),
    enabled: seller !== null,
  });
  const [moving, setMoving] = useState<MonthContract | null>(null);
  const sellers = team?.sellers ?? [];
  const name = sellers.find((row) => row.id === seller)?.name ?? '';
  const back = <BackLink to={salesPath('manager/team')}>{t('manager.seller.back')}</BackLink>;

  if (seller === null || isError)
    return (
      <>
        {back}
        <EmptyState>{t('manager.seller.missing')}</EmptyState>
      </>
    );
  if (!data) return <SkeletonRows rows={6} />;
  return (
    <>
      {back}
      <MonthReport
        data={data}
        voice="seller"
        title={t('manager.seller.title', { name, month: f.monthYear(data.month) })}
        onMonth={(value) => {
          setMoving(null);
          setParams(value === data.months[0] ? {} : { month: value });
        }}
        actions={
          sellers.length > 1 && (
            <SelectField
              inline
              label={t('manager.seller.pick')}
              value={String(seller)}
              onChange={(value) => {
                setMoving(null);
                void navigate(sellerMonthPath(Number(value), month));
              }}
              options={sellers.map((row) => ({ value: String(row.id), label: row.name }))}
            />
          )
        }
        contractAction={(row) =>
          moving?.lead === row.lead ? null : (
            <Button
              variant="outline"
              className="h-11 px-4 text-sm"
              aria-label={t('manager.contracts.moveFor', { name: named(row.name) })}
              onClick={() => setMoving(row)}
            >
              {t('manager.contracts.move')}
            </Button>
          )
        }
        contractsFooter={
          moving && (
            <MoveContractForm
              contract={moving}
              sellers={sellers.filter((row) => row.id !== seller)}
              onDone={() => setMoving(null)}
            />
          )
        }
      />
    </>
  );
}
