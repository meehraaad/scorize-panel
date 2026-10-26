import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { SectionHeading } from '@/components/ui/SectionCard';
import { useApproveApplication } from '@/lib/applicant/approval';
import { SUPERVISOR_THREAD } from '@/lib/applicant/tickets';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import type { Application } from '../api';
import { URGENT_DAYS } from '../groups';

/** Applications the supervisor suggested, waiting for the applicant's one-time decision. */
export function ApprovalCards({ items }: { items: Application[] }) {
  const { t } = useTranslation('applications');
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="apps-awaiting" className="flex flex-col gap-4">
      <SectionHeading
        id="apps-awaiting"
        title={t('awaiting.title')}
        subtitle={t('awaiting.subtitle')}
      />
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="flex">
            <ApprovalCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApprovalCard({ item }: { item: Application }) {
  const { t } = useTranslation('applications');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const approve = useApproveApplication();
  const [confirming, setConfirming] = useState(false);
  const { university } = item;
  const days = item.deadline === null ? null : daysUntil(item.deadline);
  const decide = (approved: boolean) => {
    approve.mutate({ id: item.id, approved }, { onError: () => toast.error(t('approval.error')) });
  };

  return (
    <Card className="flex w-full flex-col gap-3.5 p-5 shadow-[var(--panel-shadow),inset_0_0_0_1.5px_var(--hero-accent)] lg:p-6">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-tint px-2.5 py-0.5 font-semibold text-primary-text">
          {t('awaiting.suggested')}
        </span>
        <span className="rounded-full bg-canvas px-2.5 py-0.5 text-text-2">{item.country}</span>
        <span className="rounded-full bg-canvas px-2.5 py-0.5 text-text-2">
          {tc(`degree.${item.degree}`)}
        </span>
      </div>
      <div className="flex flex-col">
        <h3 className="m-0 text-lg font-bold lg:text-xl">
          <bdi>{university}</bdi>
        </h3>
        {item.program && <bdi className="text-sm text-text-2">{item.program}</bdi>}
      </div>
      <dl className="m-0 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-canvas px-3.5 py-2.5">
          <dt className="text-xs text-text-2">{t('awaiting.deadline')}</dt>
          <dd className="m-0 font-semibold">
            {item.deadline ? f.date(item.deadline) : t('awaiting.noDeadline')}
          </dd>
          {days !== null && days > 0 && (
            <dd className={`m-0 text-xs ${days <= URGENT_DAYS ? 'text-urgent' : 'text-text-2'}`}>
              {t('awaiting.daysLeft', { n: f.number(days) })}
            </dd>
          )}
        </div>
        <div className="rounded-2xl bg-canvas px-3.5 py-2.5">
          <dt className="text-xs text-text-2">{t('awaiting.fee')}</dt>
          <dd className="m-0 font-semibold">
            {item.fee ? f.moneyName(item.fee.amount, item.fee.currency) : t('card.noFee')}
          </dd>
        </div>
      </dl>
      {item.supervisor_note && (
        <p className="m-0 rounded-2xl bg-warn-tint px-3.5 py-3 text-sm leading-7">
          <span className="font-semibold">{t('noteLabel')}</span> {item.supervisor_note}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-1">
        {confirming ? (
          <InlineConfirm
            message={t('approval.confirm', { university })}
            confirmLabel={t('approval.confirmYes')}
            cancelLabel={t('approval.confirmNo')}
            pending={approve.isPending}
            onConfirm={() => decide(false)}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <>
            <Button
              aria-label={t('approval.approveAria', { university })}
              disabled={approve.isPending}
              onClick={() => decide(true)}
              className="flex-[2_1_160px]"
            >
              {t('approval.approve')}
            </Button>
            <Button
              variant="danger"
              aria-label={t('approval.rejectAria', { university })}
              disabled={approve.isPending}
              onClick={() => setConfirming(true)}
              className="flex-[1_1_90px] shadow-[inset_0_0_0_1px_var(--line-2)]"
            >
              {t('approval.reject')}
            </Button>
            <Link
              to={`/tickets/${SUPERVISOR_THREAD}`}
              className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary-text"
            >
              {t('awaiting.ask')}
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}
