import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard, SectionHeading } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  assignQuery,
  useAssignLeads,
  useAssignSettings,
  type AssignMode,
  type AssignSettings,
  type Escalation,
  type SellerLoad,
  type UnassignedLead,
} from '../api';
import { ScoreChip } from '../components/LeadChips';
import { useSalesFormat } from '../format';
import { toast } from '@/lib/toast';

const MODES = ['round_robin', 'least_load', 'match'] as const satisfies readonly AssignMode[];
const ESCALATIONS = ['alert', 'next', 'both'] as const satisfies readonly Escalation[];
/** Open leads that fill a seller's bar. */
const FULL_LOAD = 20;
const HEAVY_LOAD = 16;

/** Leads nobody owns, the sellers' load right now, and automatic assignment. Canvas "تخصیص لید". */
export default function AssignPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const { data } = useSuspenseQuery(assignQuery);
  const assign = useAssignLeads();
  // Read once: the waiting times don't need to tick here.
  const [now] = useState(() => Date.now());
  const oldest = data.queue.reduce(
    (max, lead) => Math.max(max, Math.round((now - new Date(lead.created_at).getTime()) / 60_000)),
    0,
  );

  return (
    <>
      <PageHeader
        title={
          data.queue.length
            ? t('manager.assign.title', { n: f.number(data.queue.length) })
            : t('manager.assign.titleNone')
        }
        subtitle={
          data.queue.length ? t('manager.assign.subtitle', { age: s.duration(oldest) }) : undefined
        }
      />
      <AutoCard key={JSON.stringify(data.settings)} settings={data.settings} />

      <section aria-labelledby="sellers-title" className="flex flex-col gap-4">
        <SectionHeading id="sellers-title" title={t('manager.assign.sellers')} />
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
          {data.sellers.map((seller) => (
            <li key={seller.id}>
              <SellerCard seller={seller} />
            </li>
          ))}
        </ul>
      </section>

      <SectionCard
        id="queue-title"
        title={t('manager.assign.queue')}
        end={
          data.queue.length > 0 && (
            <Button
              variant="outline"
              disabled={assign.isPending}
              onClick={() =>
                assign.mutate(
                  data.queue.map((lead) => ({ lead: lead.lead, seller: lead.suggested })),
                  { onError: () => toast.error(t('error')) },
                )
              }
            >
              {t('manager.assign.all')}
            </Button>
          )
        }
      >
        {data.queue.length === 0 ? (
          <EmptyState>{t('manager.assign.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0 pb-2">
            {data.queue.map((lead) => (
              <QueueRow
                key={lead.lead}
                lead={lead}
                sellers={data.sellers}
                now={now}
                pending={assign.isPending}
                onAssign={(seller) =>
                  assign.mutate([{ lead: lead.lead, seller }], {
                    onError: () => toast.error(t('error')),
                  })
                }
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function AutoCard({ settings }: { settings: AssignSettings }) {
  const { t } = useTranslation('sales');
  const save = useAssignSettings();
  const [form, setForm] = useState(settings);
  const update = (change: Partial<AssignSettings>) => {
    const next = { ...form, ...change };
    setForm(next);
    save.mutate(next, { onError: () => toast.error(t('error')) });
  };
  return (
    <Card aria-labelledby="auto-title" className="flex flex-col gap-5 p-5 lg:px-8 lg:py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="auto-title" className="m-0 font-display text-lg font-bold">
            {t('manager.assign.auto')}
          </h2>
          <span className="text-sm leading-6 text-text-2">{t('manager.assign.autoText')}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.on}
          aria-label={t('manager.assign.auto')}
          onClick={() => update({ on: !form.on })}
          className={`relative h-8 w-14 flex-none rounded-full transition-colors ${form.on ? 'bg-primary' : 'bg-line-3'}`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1 size-6 rounded-full bg-surface shadow transition-[inset-inline-start] ${form.on ? 'start-7' : 'start-1'}`}
          />
        </button>
      </div>
      {form.on && (
        <div className="flex flex-wrap items-end gap-6">
          <ChoiceGroup
            legend={t('manager.assign.mode')}
            value={form.mode}
            onChange={(mode) => update({ mode })}
            options={MODES.map((value) => ({
              value,
              label: t(`manager.assign.modeOption.${value}`),
            }))}
          />
          <SelectField
            label={t('manager.assign.escalation')}
            value={form.escalation}
            onChange={(escalation) => update({ escalation })}
            options={ESCALATIONS.map((value) => ({
              value,
              label: t(`manager.assign.escalationOption.${value}`),
            }))}
          />
        </div>
      )}
    </Card>
  );
}

function SellerCard({ seller }: { seller: SellerLoad }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const status =
    seller.status === 'busy' && seller.busy_until
      ? t('manager.assign.busyUntil', { time: f.time(seller.busy_until) })
      : t(`manager.assign.status.${seller.status}`);
  return (
    <Card
      className={`flex flex-col gap-3 p-4 ${seller.status === 'away' ? 'opacity-60' : ''}`}
      aria-label={seller.name}
    >
      <span className="flex items-center gap-2.5">
        <Avatar name={seller.name} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold">{seller.name}</span>
          <span
            className={`text-xs ${seller.status === 'available' ? 'text-good' : seller.status === 'busy' ? 'text-warn' : 'text-text-2'}`}
          >
            {status}
          </span>
        </span>
      </span>
      <dl className="m-0 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-text-2">{t('manager.assign.open')}</dt>
          <dd className="m-0 font-semibold">{f.number(seller.open)}</dd>
        </div>
        <ProgressBar
          value={Math.min(100, (seller.open / FULL_LOAD) * 100)}
          size="sm"
          tone={seller.open >= HEAVY_LOAD ? 'warn' : 'primary'}
        />
        <div className="flex justify-between">
          <dt className="text-text-2">{t('manager.assign.uncalled')}</dt>
          <dd className={`m-0 font-semibold ${seller.uncalled >= 3 ? 'text-urgent' : ''}`}>
            {f.number(seller.uncalled)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-2">{t('manager.assign.response')}</dt>
          <dd className="m-0 font-semibold">{s.minutes(seller.response_minutes)}</dd>
        </div>
      </dl>
    </Card>
  );
}

function QueueRow({
  lead,
  sellers,
  now,
  pending,
  onAssign,
}: {
  lead: UnassignedLead;
  sellers: SellerLoad[];
  now: number;
  pending: boolean;
  onAssign: (seller: number) => void;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const s = useSalesFormat();
  const [seller, setSeller] = useState(String(lead.suggested));
  const minutes = Math.round((now - new Date(lead.created_at).getTime()) / 60_000);
  const meta = [
    lead.degree !== null ? tc(`degree.${lead.degree}`) : null,
    lead.countries.length ? f.list(lead.countries) : null,
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8">
      <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
        <span className="text-[15px] font-semibold">{lead.name}</span>
        <span className="text-[13px] text-text-2">{meta.join(' · ')}</span>
      </span>
      <span className="flex-[1_1_200px] text-sm text-neutral">{lead.cause}</span>
      <ScoreChip score={lead.score} />
      <span className={`w-24 text-sm font-semibold ${minutes >= 15 ? 'text-urgent' : ''}`}>
        {s.duration(minutes)}
      </span>
      <span className="flex items-center gap-2">
        <SelectField
          inline
          label={t('manager.assign.sellerFor', { name: lead.name })}
          value={seller}
          onChange={setSeller}
          options={sellers
            .filter((item) => item.status !== 'away')
            .map((item) => ({
              value: String(item.id),
              label:
                item.id === lead.suggested
                  ? t('manager.assign.suggested', { name: item.name })
                  : item.name,
            }))}
        />
        <Button
          className="h-11 px-4 text-sm"
          disabled={pending}
          onClick={() => onAssign(Number(seller))}
        >
          {t('manager.assign.assign')}
        </Button>
      </span>
    </li>
  );
}
