import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { StepBar } from '@/components/ui/Progress';
import { SheetButton } from '@/components/ui/Sheet';
import { useFormat } from '@/lib/i18n/useFormat';
import { initialOf } from '@/lib/text';
import { MESSAGE_CHANNELS, STAGES, type Channel } from '@/lib/sales/api';
import type { CustomerData } from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';
import { CustomerTags } from './CustomerTags';
import { ScoreChip, StageChip } from './LeadChips';

/** Stages on the bar (a lost lead shows its chip instead of a step). */
const BAR = STAGES.filter((stage) => stage !== 'lost');

// Opens on a click: the date picker it uses is not part of the page's first load.
const FollowUpDialog = lazy(() =>
  import('./FollowUpDialog').then((module) => ({ default: module.FollowUpDialog })),
);

/**
 * Top of the customer page (sales): who, the actions, the one next step and the stage bar.
 * Contact details live in the shared column (`side`), which phones open from here.
 * Canvas "صفحه‌ی مشتری", board Head.
 */
export function CustomerHead({
  customer,
  onLog,
  onSell,
  side,
}: {
  customer: CustomerData;
  onLog: (channel: Channel) => void;
  /** Opens the product sale. */
  onSell: () => void;
  /** The shared column, shown in a sheet where it doesn't fit beside the page (null: it does). */
  side: ReactNode;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const { lead, headline } = customer;

  const line = [
    [headline.degree !== null ? tc(`degree.${headline.degree}`) : '', headline.field ?? '']
      .join(' ')
      .trim(),
    headline.countries.length ? f.list(headline.countries) : '',
  ].filter(Boolean);

  return (
    <section
      aria-label={t('customer.summary')}
      className="flex flex-col gap-5 rounded-card-sm bg-surface p-5 shadow-panel lg:rounded-card lg:p-7"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 flex-none items-center justify-center rounded-full bg-tint text-xl font-bold text-primary-text"
        >
          {initialOf(customer.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 font-display text-2xl font-bold">{customer.name}</h1>
            {lead && lead.score !== null && <ScoreChip score={lead.score} />}
            {lead && <StageChip stage={lead.stage} />}
          </div>
          {line.length > 0 && <span className="text-[15px] text-text-2">{line.join(' · ')}</span>}
          {/* The team's sales tags (S49): sales work, so here rather than in the shared column. */}
          {customer.supports.tags && <CustomerTags customer={customer} />}
        </div>
        {side && (
          <SheetButton
            icon="user"
            label={t('side.open')}
            title={t('side.title')}
            closeLabel={t('side.close')}
          >
            <div className="flex flex-col gap-4">{side}</div>
          </SheetButton>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onLog('call')} className={buttonClass('primary')}>
          <Icon name="phone" size={18} />
          {t('customer.log')}
        </button>
        {MESSAGE_CHANNELS.map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => onLog(channel)}
            className={buttonClass('outline', 'px-4 text-sm')}
          >
            <Icon name={channel === 'sms' ? 'chat' : 'send'} size={16} />
            {t(`channel.${channel}`)}
          </button>
        ))}
        <NewSaleMenu customer={customer.id} onSell={onSell} />
      </div>

      {lead && <NextStep customer={customer} onCall={() => onLog('call')} />}

      {lead && lead.stage !== 'lost' && (
        <StepBar
          label={t('customer.stages')}
          steps={BAR.map((stage) => ({ key: stage, label: t(`stageShort.${stage}`) }))}
          current={BAR.indexOf(lead.stage)}
          finished={lead.stage === 'won'}
        />
      )}
    </section>
  );
}

/** The dark strip: the one thing to do next (the follow-up), with "log it" and "another time". */
function NextStep({ customer, onCall }: { customer: CustomerData; onCall: () => void }) {
  const { t } = useTranslation('sales');
  const s = useSalesFormat();
  const [moving, setMoving] = useState(false);
  const lead = customer.lead;
  if (!lead) return null;
  const lost = lead.stage === 'lost';
  const due = s.due(lead.follow_up_at, lead.stage, lead.stage !== 'new');
  const text =
    lost && lead.lost_reason
      ? t('customer.lostBecause', { reason: t(`lost.${lead.lost_reason}`) })
      : lead.follow_up_at || lead.stage === 'new'
        ? due.text
        : t('customer.noFollowUp');
  const first = lead.stage === 'new' && !lead.follow_up_at;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-hero px-4 py-3.5 text-on-hero lg:px-5">
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="text-xs text-on-hero-2">
          {t(first ? 'next.first' : lost ? 'next.lost' : 'next.label')}
        </span>
        <span className={`text-base font-bold ${due.urgent && !lost ? 'text-hero-current' : ''}`}>
          {text}
        </span>
      </span>
      {!lost && (
        <span className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCall}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-on-hero px-4 text-sm font-semibold text-hero"
          >
            {t('next.log')}
          </button>
          <button
            type="button"
            onClick={() => setMoving(true)}
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-raised"
          >
            {t(lead.follow_up_at ? 'next.move' : 'next.set')}
          </button>
        </span>
      )}
      {moving && (
        <Suspense fallback={null}>
          <FollowUpDialog
            open
            onClose={() => setMoving(false)}
            at={lead.follow_up_at ? new Date(lead.follow_up_at) : null}
            lead={{ id: lead.id, name: customer.name }}
          />
        </Suspense>
      )}
    </div>
  );
}

/** "New sale ▾": sell a product now, or prepare a contract offer. A native disclosure. */
function NewSaleMenu({ customer, onSell }: { customer: number; onSell: () => void }) {
  const { t } = useTranslation('sales');
  const menu = useRef<HTMLDetailsElement>(null);
  const item =
    'flex min-h-11 flex-col gap-0.5 rounded-2xl px-4 py-2.5 text-start text-text hover:bg-canvas';
  return (
    <details
      ref={menu}
      className="group relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') menu.current?.removeAttribute('open');
      }}
    >
      <summary
        className={buttonClass(
          'dark',
          'cursor-pointer list-none px-4 text-sm [&::-webkit-details-marker]:hidden',
        )}
      >
        <Icon name="plus" size={16} />
        {t('customer.newSale.label')}
        <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute start-0 top-12 z-10 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-card-sm bg-surface p-2 shadow-panel">
        <button
          type="button"
          className={item}
          onClick={() => {
            menu.current?.removeAttribute('open');
            onSell();
          }}
        >
          <span className="text-[15px] font-semibold">{t('customer.newSale.product')}</span>
          <span className="text-xs leading-5 text-text-2">{t('customer.newSale.productHint')}</span>
        </button>
        <Link to={`${customerPath(customer)}/offer`} className={item}>
          <span className="text-[15px] font-semibold">{t('customer.newSale.offer')}</span>
          <span className="text-xs leading-5 text-text-2">{t('customer.newSale.offerHint')}</span>
        </Link>
      </div>
    </details>
  );
}
