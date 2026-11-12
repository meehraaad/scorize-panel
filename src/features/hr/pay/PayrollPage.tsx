import { useQuery } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { PersonLink } from '../components/PersonLink';
import {
  payMonth,
  payrollQuery,
  useFinalPayroll,
  useStartPayroll,
  type Payroll,
  type Slip,
} from './api';
import { MonthBar } from './components/MonthBar';

const PayslipDialog = lazy(() => import('./components/PayslipDialog'));

/**
 * A month's pay: start it (a draft worked out from the files and KPI results), check each slip
 * (additions and deductions by hand), then make it final. A row opens the payslip.
 */
export default function PayrollPage() {
  const { t } = useTranslation('hr');
  const [shift, setShift] = useState(0);
  const month = payMonth(shift);
  const { data } = useQuery(payrollQuery(month));
  const start = useStartPayroll();
  const [open, setOpen] = useState<number | null>(null);

  const begin = () =>
    start.mutate(month, {
      onSuccess: () => toast.success(t('pay.payroll.started')),
      onError: () => toast.error(t('error')),
    });

  return (
    <>
      <MonthBar month={month} shift={shift} onShift={setShift}>
        {data?.status && (
          <Chip tone={data.status === 'final' ? 'good' : 'warn'} dot>
            {t(`pay.payroll.status.${data.status}`)}
          </Chip>
        )}
      </MonthBar>
      {!data ? (
        <Card className="p-5">
          <SkeletonRows rows={5} />
        </Card>
      ) : data.id === null ? (
        <EmptyState
          variant="card"
          icon="card"
          title={t('pay.payroll.none')}
          action={
            <Button disabled={start.isPending} onClick={begin}>
              {t('pay.payroll.start')}
            </Button>
          }
        >
          {t('pay.payroll.noneHint')}
        </EmptyState>
      ) : (
        <Month data={data} onOpen={setOpen} onRecount={begin} recounting={start.isPending} />
      )}
      {open !== null && (
        <Suspense fallback={null}>
          <PayslipDialog id={open} month={month} onClose={() => setOpen(null)} />
        </Suspense>
      )}
    </>
  );
}

function Month({
  data,
  onOpen,
  onRecount,
  recounting,
}: {
  data: Payroll;
  onOpen: (id: number) => void;
  onRecount: () => void;
  recounting: boolean;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const final = useFinalPayroll();
  const [confirming, setConfirming] = useState(false);
  const toman = (amount: number) => t('toman', { amount: f.number(amount) });
  const draft = data.status === 'draft';

  return (
    <>
      <StatGrid
        label={t('pay.payroll.totals')}
        stats={[
          {
            label: t('pay.slip.gross'),
            value: f.number(data.totals.gross),
            unit: t('pay.tomanUnit'),
          },
          {
            label: t('pay.payroll.taxAndInsurance'),
            value: f.number(data.totals.tax + data.totals.insurance),
            unit: t('pay.tomanUnit'),
          },
          {
            label: t('pay.slip.net'),
            value: f.number(data.totals.net),
            unit: t('pay.tomanUnit'),
            tone: 'primary',
          },
          { label: t('pay.payroll.people'), value: f.number(data.slips.length) },
        ]}
      />
      <Card aria-label={t('pay.payroll.label')}>
        {data.slips.length === 0 ? (
          <EmptyState variant="padded">{t('pay.payroll.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0 py-2">
            {data.slips.map((slip) => (
              <SlipRow key={slip.id} slip={slip} onOpen={() => onOpen(slip.id)} toman={toman} />
            ))}
          </ul>
        )}
      </Card>
      {draft && data.id !== null && (
        <Card className="flex flex-col gap-3 p-5 lg:px-8">
          <p className="m-0 text-sm text-text-2">{t('pay.payroll.draftHint')}</p>
          {confirming ? (
            <InlineConfirm
              message={t('pay.payroll.finalConfirm')}
              confirmLabel={t('pay.payroll.final')}
              cancelLabel={t('close')}
              pending={final.isPending}
              onCancel={() => setConfirming(false)}
              onConfirm={() =>
                data.id !== null &&
                final.mutate(data.id, {
                  onSuccess: () => {
                    toast.success(t('pay.payroll.finalDone'));
                    setConfirming(false);
                  },
                  onError: () => toast.error(t('error')),
                })
              }
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setConfirming(true)}>{t('pay.payroll.final')}</Button>
              <Button variant="outline" disabled={recounting} onClick={onRecount}>
                {t('pay.payroll.recount')}
              </Button>
            </div>
          )}
        </Card>
      )}
      {data.status === 'final' && data.finalized_at && (
        <p className="m-0 text-sm text-text-2">
          {t('pay.payroll.finalBy', {
            name: data.finalized_by ?? '–',
            date: f.date(data.finalized_at),
          })}
        </p>
      )}
    </>
  );
}

function SlipRow({
  slip,
  onOpen,
  toman,
}: {
  slip: Slip;
  onOpen: () => void;
  toman: (amount: number) => string;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hair px-5 py-2.5 first:border-t-0 lg:px-8">
      <div className="min-w-0 flex-[1_1_200px]">
        <PersonLink
          id={slip.staff.id}
          name={slip.staff.name}
          face={slip.staff.face}
          sub={slip.position ?? undefined}
        />
      </div>
      <span className="flex-[0_1_140px] text-sm text-text-2">
        {slip.kpi_score === null
          ? t('pay.slip.noScore')
          : t('pay.slip.score', { score: f.number(slip.kpi_score) })}
      </span>
      <span className="flex-[0_1_160px] text-sm font-bold">{toman(slip.net)}</span>
      <Button variant="outline" onClick={onOpen}>
        {t('pay.slip.open')}
      </Button>
    </li>
  );
}
