import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChoiceGroup, SelectField, TogglePill } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pager } from '@/components/ui/Pager';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard, SectionHeading } from '@/components/ui/SectionCard';
import { pagesOf, useClampPage } from '@/lib/api/page';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  assignQuery,
  useAssignLeads,
  useAssignSettings,
  useHiddenSellers,
  type AssignMode,
  type AssignSettings,
  type Escalation,
  type SellerLoad,
  type UnassignedLead,
} from '../api';
import { ScoreChip } from '../components/LeadChips';
import { useSalesFormat } from '../format';
import { LeadImportDialog } from './LeadImportDialog';
import { toast } from '@/lib/toast';

const MODES = ['round_robin', 'least_load', 'match'] as const satisfies readonly AssignMode[];
/** Working-hour choices, every half hour. */
const HOURS = Array.from(
  { length: 48 },
  (_, n) => `${String(Math.floor(n / 2)).padStart(2, '0')}:${n % 2 ? '30' : '00'}`,
);
const ANY_TIME = 'any';
/** How long a new lead may wait for its first call, in minutes. */
const WAITS = [15, 30, 60, 120, 240, 1440, 2880, 4320, 10080];
const HOUR = 60;
const DAY = 24 * HOUR;
const DAY_START = '09:00';
const DAY_END = '21:00';
const ESCALATIONS = ['alert', 'next', 'both'] as const satisfies readonly Escalation[];
/** Open leads that fill a seller's bar. */
const FULL_LOAD = 20;
const HEAVY_LOAD = 16;

/** Leads nobody owns, the sellers' load right now, and automatic assignment. Canvas "تخصیص لید". */
export default function AssignPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const [page, setPage] = useState(1);
  // Another page keeps this one on screen until it arrives (no loader in its place).
  const [turning, startTurning] = useTransition();
  const { data } = useSuspenseQuery(assignQuery(page));
  const queue = data.queue.results;
  const suggested = queue.flatMap((lead) =>
    lead.suggested === null ? [] : [{ lead: lead.lead, seller: lead.suggested }],
  );
  const pages = pagesOf(data.queue);
  useClampPage(data.queue, page, setPage);
  const assign = useAssignLeads();
  // Read once: the waiting times don't need to tick here.
  const [now] = useState(() => Date.now());
  const [importing, setImporting] = useState(false);
  const oldest = data.oldest_at
    ? Math.max(0, Math.round((now - new Date(data.oldest_at).getTime()) / 60_000))
    : 0;

  return (
    <>
      <PageHeader
        title={
          data.queue.count
            ? t('manager.assign.title', { n: f.number(data.queue.count) })
            : t('manager.assign.titleNone')
        }
        subtitle={
          data.queue.count ? t('manager.assign.subtitle', { age: s.duration(oldest) }) : undefined
        }
        actions={
          <Button variant="outline" onClick={() => setImporting(true)}>
            {t('manager.import.open')}
          </Button>
        }
      />
      <LeadImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        sellers={data.sellers}
      />
      <AutoCard
        key={JSON.stringify(data.settings)}
        settings={data.settings}
        sellers={data.sellers}
      />

      <SellerLoads sellers={data.sellers} />

      <SectionCard
        id="queue-title"
        title={t('manager.assign.queue')}
        end={
          queue.length > 0 && (
            <Button
              variant="outline"
              disabled={assign.isPending || suggested.length === 0}
              onClick={() => assign.mutate(suggested, { onError: () => toast.error(t('error')) })}
            >
              {t(pages > 1 ? 'manager.assign.allPage' : 'manager.assign.all')}
            </Button>
          )
        }
      >
        {queue.length === 0 ? (
          <EmptyState>{t('manager.assign.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0 pb-2">
            {queue.map((lead) => (
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
        {pages > 1 && (
          <Pager
            page={page}
            pages={pages}
            pending={turning}
            onPage={(next) => startTurning(() => setPage(next))}
          />
        )}
      </SectionCard>
    </>
  );
}

function AutoCard({ settings, sellers }: { settings: AssignSettings; sellers: SellerLoad[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
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
            label={t('manager.assign.wait')}
            value={String(form.escalate_after)}
            onChange={(value) => update({ escalate_after: Number(value) })}
            options={[...new Set([...WAITS, form.escalate_after])]
              .sort((a, b) => a - b)
              .map((minutes) => ({
                value: String(minutes),
                label:
                  minutes % DAY === 0
                    ? t('manager.assign.waitDays', { n: f.number(minutes / DAY) })
                    : minutes % HOUR === 0
                      ? t('manager.assign.waitHours', { n: f.number(minutes / HOUR) })
                      : t('manager.assign.waitMinutes', { n: f.number(minutes) }),
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
          <SelectField
            label={t('manager.assign.dayStart')}
            value={form.day_start ?? ANY_TIME}
            onChange={(value) =>
              update(
                value === ANY_TIME
                  ? { day_start: null, day_end: null }
                  : {
                      day_start: value,
                      day_end:
                        form.day_end && form.day_end !== value
                          ? form.day_end
                          : value === DAY_END
                            ? DAY_START
                            : DAY_END,
                    },
              )
            }
            options={[
              { value: ANY_TIME, label: t('manager.assign.anyTime') },
              ...HOURS.map((value) => ({ value, label: f.digits(value) })),
            ]}
          />
          {form.day_start !== null && (
            <SelectField
              label={t('manager.assign.dayEnd')}
              value={form.day_end ?? DAY_END}
              onChange={(value) => update({ day_end: value })}
              options={HOURS.filter((value) => value !== form.day_start).map((value) => ({
                value,
                label: f.digits(value),
              }))}
            />
          )}
        </div>
      )}
      {form.on && sellers.length > 0 && (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 p-0 text-[15px] font-semibold">{t('manager.assign.who')}</legend>
          <div className="flex flex-wrap gap-2">
            {sellers.map((seller) => (
              <TogglePill
                key={seller.id}
                label={seller.name}
                checked={!form.skipped_sellers.includes(seller.id)}
                onChange={(checked) =>
                  update({
                    skipped_sellers: checked
                      ? form.skipped_sellers.filter((id) => id !== seller.id)
                      : [...form.skipped_sellers, seller.id],
                  })
                }
              />
            ))}
          </div>
          <span className="text-sm leading-6 text-text-2">{t('manager.assign.whoText')}</span>
        </fieldset>
      )}
      {form.on && (
        <span className="text-sm leading-6 text-text-2">
          {t('manager.assign.waitText')}
          {form.day_start !== null && ` ${t('manager.assign.hoursText')}`}
        </span>
      )}
    </Card>
  );
}

/** The load cards; a manager hides some (one list for every manager) and shows them again. */
function SellerLoads({ sellers }: { sellers: SellerLoad[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const hide = useHiddenSellers();
  const [showHidden, setShowHidden] = useState(false);
  const hidden = sellers.filter((seller) => seller.hidden);
  const shown =
    showHidden || hidden.length === 0 ? sellers : sellers.filter((seller) => !seller.hidden);
  const toggle = (seller: SellerLoad) => {
    const ids = hidden.map((item) => item.id).filter((id) => id !== seller.id);
    hide.mutate(seller.hidden ? ids : [...ids, seller.id], {
      onSuccess: () =>
        toast.success(
          t(seller.hidden ? 'manager.assign.unhidden' : 'manager.assign.hiddenDone', {
            name: seller.name,
          }),
        ),
      onError: () => toast.error(t('error')),
    });
  };
  return (
    <section aria-labelledby="sellers-title" className="flex flex-col gap-4">
      <SectionHeading
        id="sellers-title"
        title={t('manager.assign.sellers')}
        end={
          hidden.length > 0 && (
            <Button
              variant="outline"
              className="h-11 px-4 text-sm"
              aria-pressed={showHidden}
              onClick={() => setShowHidden(!showHidden)}
            >
              {showHidden
                ? t('manager.assign.hideHidden')
                : t('manager.assign.showHidden', { n: f.number(hidden.length) })}
            </Button>
          )
        }
      />
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-5">
        {shown.map((seller) => (
          <li key={seller.id}>
            <SellerCard seller={seller} pending={hide.isPending} onToggle={() => toggle(seller)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SellerCard({
  seller,
  pending,
  onToggle,
}: {
  seller: SellerLoad;
  pending: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const extension = (value: number | null) =>
    value === null ? t('manager.assign.noExtension') : f.digits(String(value));
  const status =
    seller.status === 'busy' && seller.busy_until
      ? t('manager.assign.busyUntil', { time: f.time(seller.busy_until) })
      : t(`manager.assign.status.${seller.status}`);
  return (
    <Card
      className={`flex flex-col gap-3 p-4 ${seller.status === 'away' || seller.hidden ? 'opacity-60' : ''}`}
      aria-label={seller.name}
    >
      <span className="flex items-center gap-2.5">
        <Avatar name={seller.name} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">{seller.name}</span>
          <span
            className={`text-xs ${seller.status === 'available' ? 'text-good' : seller.status === 'busy' ? 'text-warn' : 'text-text-2'}`}
          >
            {[
              status,
              !seller.auto && t('manager.assign.noAuto'),
              seller.hidden && t('manager.assign.hiddenTag'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <IconButton
          icon={seller.hidden ? 'eye' : 'eyeOff'}
          tone="muted"
          iconSize={18}
          className="-me-2"
          disabled={pending}
          aria-label={t(seller.hidden ? 'manager.assign.unhide' : 'manager.assign.hide', {
            name: seller.name,
          })}
          onClick={onToggle}
        />
      </span>
      <dl className="m-0 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-text-2">{t('manager.assign.deskExtension')}</dt>
          <dd className="m-0 font-semibold">{extension(seller.office_extension)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-2">{t('manager.assign.mobileExtension')}</dt>
          <dd className="m-0 font-semibold">{extension(seller.mobile_extension)}</dd>
        </div>
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
          <dd className="m-0 font-semibold">
            {seller.response_minutes === null
              ? t('month.speed.noData')
              : s.minutes(seller.response_minutes)}
          </dd>
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
  const [seller, setSeller] = useState(lead.suggested === null ? '' : String(lead.suggested));
  const available = sellers.filter((item) => item.status !== 'away');
  const canAssign = available.some((item) => String(item.id) === seller);
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
          hideLabel
          label={t('manager.assign.sellerFor', { name: lead.name })}
          value={seller}
          onChange={setSeller}
          options={[
            { value: '', label: t('manager.assign.chooseSeller') },
            ...available.map((item) => ({
              value: String(item.id),
              label:
                item.id === lead.suggested
                  ? t('manager.assign.suggested', { name: item.name })
                  : item.name,
            })),
          ]}
        />
        <Button
          className="h-11 px-4 text-sm"
          disabled={pending || !canAssign}
          onClick={() => onAssign(Number(seller))}
        >
          {t('manager.assign.assign')}
        </Button>
      </span>
    </li>
  );
}
