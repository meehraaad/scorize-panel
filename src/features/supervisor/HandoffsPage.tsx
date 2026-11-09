import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SelectField, TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';
import {
  handoffsQuery,
  useAssignSupervisor,
  useCancelHandoff,
  type HandoffCase,
  type HandoffSupervisor,
} from './api';

const PAYMENT_TONE: Record<NonNullable<HandoffCase['prepayment']>['status'], ChipTone> = {
  unpaid: 'warn',
  review: 'info',
  declined: 'danger',
  paid: 'good',
};

/**
 * New cases from approved sales offers, waiting for a supervisor (SV18–SV20). A case can be
 * assigned once the signed contract is uploaded and the prepayment paid; that starts it. One that
 * won't start is cancelled with a reason, unless its prepayment is paid (refunded in the admin).
 */
export default function HandoffsPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const { data } = useSuspenseQuery(handoffsQuery);
  const ready = data.results.filter((item) => item.state === 'supervisor').length;

  return (
    <PageStack>
      <PageHeader
        title={t('handoffs.title')}
        subtitle={
          data.results.length
            ? t('handoffs.subtitle', {
                n: f.number(data.results.length),
                ready: f.number(ready),
              })
            : t('handoffs.subtitleNone')
        }
      />
      {data.results.length === 0 ? (
        <EmptyState variant="card">{t('handoffs.empty')}</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {data.results.map((item) => (
            <li key={item.case}>
              <HandoffRow item={item} supervisors={data.supervisors} />
            </li>
          ))}
        </ul>
      )}
    </PageStack>
  );
}

function HandoffRow({
  item,
  supervisors,
}: {
  item: HandoffCase;
  supervisors: HandoffSupervisor[];
}) {
  const { t } = useTranslation('supervisor');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const assign = useAssignSupervisor();
  const [chosen, setChosen] = useState(String(item.suggested ?? supervisors[0]?.id ?? ''));
  const [cancelling, setCancelling] = useState(false);
  const ready = item.state === 'supervisor';
  const money = item.prepayment?.status === 'paid' || item.prepayment?.status === 'review';
  const titleId = `handoff-${String(item.case)}`;

  const submit = () => {
    const person = supervisors.find((entry) => String(entry.id) === chosen);
    if (!person) return;
    assign.mutate(
      { id: item.case, supervisor: person.id },
      {
        onSuccess: () =>
          toast.success(t('handoffs.done', { name: item.name, supervisor: person.name })),
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('handoffs.notReady')
              : t('saveError'),
          ),
      },
    );
  };

  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="m-0 text-lg font-bold">
            {item.name}
          </h2>
          <span className="text-sm text-text-2">
            {f.list([
              ...item.features.map((key) => t(`handoffs.feature.${key}`)),
              ...item.degrees.map((degree) => tc(`degree.${degree}`)),
            ])}
            {' · '}
            {f.list(item.countries)}
          </span>
          <span className="text-xs text-text-2">
            {t('handoffs.meta', {
              seller: item.seller || t('handoffs.noSeller'),
              when: item.approved_at ? f.timeAgo(item.approved_at) : '',
              amount: t('handoffs.toman', { amount: f.number(item.amount) }),
            })}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={item.scans.length ? 'good' : 'warn'} small>
            {item.scans.length ? t('handoffs.signed') : t('handoffs.notSigned')}
          </Chip>
          {item.prepayment && (
            <Chip tone={PAYMENT_TONE[item.prepayment.status]} small>
              {t(`handoffs.payment.${item.prepayment.status}`)}
            </Chip>
          )}
        </div>
      </div>

      {item.scans.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
          {item.scans.map((scan, index) => (
            <li key={scan.id}>
              <a
                href={safeHref(scan.url) ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-primary-text underline"
              >
                {t('handoffs.scan', { n: f.number(index + 1) })}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <SelectField
            label={t('handoffs.supervisor')}
            value={chosen}
            onChange={setChosen}
            hint={item.suggested === null ? undefined : t('handoffs.suggested')}
            options={supervisors.map((person) => ({
              value: String(person.id),
              label: t('handoffs.option', {
                name: person.name,
                n: f.number(person.active),
                countries: person.countries.length
                  ? f.list(person.countries)
                  : t('handoffs.anyCountry'),
              }),
            }))}
          />
        </div>
        <Button disabled={!ready || !chosen || assign.isPending} onClick={submit}>
          {t('handoffs.assign')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {item.state !== 'supervisor' ? (
          <span className="text-xs text-text-2">{t(`handoffs.waiting.${item.state}`)}</span>
        ) : (
          <span />
        )}
        <Button
          variant="danger"
          disabled={money}
          onClick={() => setCancelling(true)}
          aria-describedby={money ? `${titleId}-paid` : undefined}
        >
          {t('handoffs.cancel.open', { name: item.name })}
        </Button>
      </div>
      {money && (
        <span id={`${titleId}-paid`} className="text-xs text-text-2">
          {t('handoffs.cancel.paid')}
        </span>
      )}
      <CancelDialog item={item} open={cancelling} onClose={() => setCancelling(false)} />
    </Card>
  );
}

function CancelDialog({
  item,
  open,
  onClose,
}: {
  item: HandoffCase;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const cancel = useCancelHandoff();
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);

  const submit = () => {
    setTried(true);
    if (!reason.trim()) return;
    cancel.mutate(
      { id: item.case, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t('handoffs.cancel.done', { name: item.name }));
          onClose();
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('handoffs.cancel.paid')
              : t('saveError'),
          ),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('handoffs.cancel.title', { name: item.name })}
      subtitle={t('handoffs.cancel.text')}
      closeLabel={t('close')}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" disabled={cancel.isPending} onClick={submit}>
            {t('handoffs.cancel.confirm', { name: item.name })}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('handoffs.cancel.keep')}
          </Button>
        </div>
      }
    >
      <TextAreaField
        label={t('handoffs.cancel.reason')}
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        hint={tried && !reason.trim() ? t('handoffs.cancel.reasonRequired') : undefined}
      />
    </Dialog>
  );
}
