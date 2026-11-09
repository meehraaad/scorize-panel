import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon, type IconName } from '@/components/ui/Icon';
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
    lead?.seller ? t('customer.sellerLine', { name: lead.seller }) : '',
  ].filter(Boolean);

  return (
    <section aria-label={t('customer.summary')} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-12 flex-none items-center justify-center rounded-2xl bg-primary text-xl font-extrabold text-on-primary sm:size-[60px] sm:rounded-[20px] sm:text-2xl"
          >
            {initialOf(customer.name)}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 font-display text-[22px] font-extrabold lg:text-[26px]">
                {customer.name}
              </h1>
              {lead && <StageChip stage={lead.stage} />}
              {lead && lead.score !== null && <ScoreChip score={lead.score} />}
            </div>
            {line.length > 0 && <span className="text-sm text-text-2">{line.join(' · ')}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-[1fr_1fr_auto]">
          <button
            type="button"
            onClick={() => onLog('call')}
            className={buttonClass('primary', 'h-13 max-sm:col-span-3', 'lg')}
          >
            <Icon name="phone" size={19} />
            {t('customer.log')}
          </button>
          <MessageMenu onLog={onLog} />
          <NewSaleMenu customer={customer.id} onSell={onSell} />
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
      </div>

      {/* The team's sales tags (S49): sales work, so here rather than in the shared column. */}
      {customer.supports.tags && <CustomerTags customer={customer} />}

      {lead && <NextStep customer={customer} onCall={() => onLog('call')} />}

      {lead && lead.stage !== 'lost' && (
        <StepBar
          tone="plum"
          label={t('customer.stages')}
          steps={BAR.map((stage) => ({ key: stage, label: t(`stageShort.${stage}`) }))}
          current={BAR.indexOf(lead.stage)}
          finished={lead.stage === 'won'}
        />
      )}
    </section>
  );
}

const menuItem =
  'flex min-h-11 items-center gap-3 rounded-2xl px-4 py-2.5 text-start text-[15px] font-medium text-text hover:bg-canvas';

/** A native disclosure menu: closes on Escape and after a choice. */
function Menu({
  label,
  icon,
  className = '',
  children,
}: {
  label: string;
  icon: IconName;
  className?: string;
  children: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute('open');
  return (
    <details
      ref={menu}
      className="group relative max-sm:min-w-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <summary
        className={buttonClass(
          'outline',
          `h-13 cursor-pointer list-none max-sm:w-full max-sm:px-4 [&::-webkit-details-marker]:hidden ${className}`,
          'lg',
        )}
      >
        <Icon name={icon} size={17} />
        {label}
        <Icon name="chevronDown" size={15} className="transition-transform group-open:rotate-180" />
      </summary>
      {/* A choice closes the menu. */}
      <div
        className="absolute end-0 top-14 z-10 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-card-sm bg-surface p-2 shadow-panel"
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('button, a')) close();
        }}
      >
        {children}
      </div>
    </details>
  );
}

/** "Message ▾": WhatsApp, Telegram or SMS, each opening the contact log on that channel. */
function MessageMenu({ onLog }: { onLog: (channel: Channel) => void }) {
  const { t } = useTranslation('sales');
  return (
    <Menu label={t('customer.message')} icon="chat">
      {MESSAGE_CHANNELS.map((channel) => (
        <button key={channel} type="button" className={menuItem} onClick={() => onLog(channel)}>
          <Icon name={channel === 'sms' ? 'chat' : 'send'} size={17} />
          {t(`channel.${channel}`)}
        </button>
      ))}
    </Menu>
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
  // The follow-up is a task of mine (StaffToDo): its text is what to do.
  const task = lead.follow_up_at
    ? customer.tasks
        .filter((item) => item.kind === 'mine' && item.status !== 'done')
        .sort((a, b) => a.due_at.localeCompare(b.due_at))[0]
    : undefined;
  const label = t(first ? 'next.first' : lost ? 'next.lost' : 'next.label');

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[20px] bg-hero px-4 py-3.5 text-on-hero lg:px-5">
      <span className="flex min-w-0 flex-[1_1_220px] items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-10 flex-none items-center justify-center rounded-xl bg-hero-raised text-hero-current"
        >
          <Icon name="clock" size={19} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-on-hero-2">{task ? `${label} · ${text}` : label}</span>
          <span
            className={`text-[15.5px] font-bold ${due.urgent && !lost && !task ? 'text-hero-current' : ''}`}
          >
            {task ? task.text : text}
          </span>
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

/** "Sale ▾": sell a product now, or prepare a contract offer. */
function NewSaleMenu({ customer, onSell }: { customer: number; onSell: () => void }) {
  const { t } = useTranslation('sales');
  const item = `${menuItem} flex-col items-start gap-0.5`;
  return (
    <Menu label={t('customer.newSale.label')} icon="plus">
      <>
        <button type="button" className={item} onClick={onSell}>
          <span className="font-semibold">{t('customer.newSale.product')}</span>
          <span className="text-xs leading-5 font-normal text-text-2">
            {t('customer.newSale.productHint')}
          </span>
        </button>
        <Link to={`${customerPath(customer)}/offer`} className={item}>
          <span className="font-semibold">{t('customer.newSale.offer')}</span>
          <span className="text-xs leading-5 font-normal text-text-2">
            {t('customer.newSale.offerHint')}
          </span>
        </Link>
      </>
    </Menu>
  );
}
