import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomerFace } from '@/components/customers/CustomerFace';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Dock, DockDivider } from '@/components/ui/Dock';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton, IconLink } from '@/components/ui/IconButton';
import { StepBar } from '@/components/ui/Progress';
import { SheetButton } from '@/components/ui/Sheet';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { toast } from '@/lib/toast';
import { CHANNEL_ICON, SALES_API, type Channel } from '@/lib/sales/api';
import { messageHref } from '@/lib/sales/messageLink';
import { customerKey, type CustomerData, type MoveSteps } from '../api';
import { useMoveBoardCard } from '../api/boardMutations';
import { boardMoveTargets, laneOf, lanesOf, type Lane } from '../boardLanes';
import { useSalesFormat } from '../format';
import { CopyTabletLink } from './CopyTabletLink';
import { CustomerTags } from './CustomerTags';
import { ScoreChip, StageChip } from './LeadChips';

// Opens when a column is picked on the stage bar: the board's own "entering a stage" popup.
const EnterStageDialog = lazy(() =>
  import('./EnterStageDialog').then((module) => ({ default: module.EnterStageDialog })),
);

// Opens on a click: the meeting window (its week of rooms) is not part of the page's first load.
const VisitDialog = lazy(() =>
  import('./VisitDialog').then((module) => ({ default: module.VisitDialog })),
);

// Opens on a click: which ready message to send on WhatsApp or Telegram.
const WhatsAppPicker = lazy(() =>
  import('./WhatsAppPicker').then((module) => ({ default: module.WhatsAppPicker })),
);

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
  onContract,
  side,
}: {
  customer: CustomerData;
  onLog: (channel: Channel) => void;
  /** Opens the product sale. */
  onSell: () => void;
  /** Opens the choice of a contract to start (S71). */
  onContract: () => void;
  /** The shared column, shown in a sheet where it doesn't fit beside the page (null: it does). */
  side: ReactNode;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
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
      {/* Lit in the customer's picked colour (their face colour), else the brand plum. */}
      <div
        data-hue={customer.face?.color || undefined}
        className="flex animate-rise flex-col gap-5 rounded-card p-5 shadow-aurora bg-aurora lg:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 items-center gap-4">
            <CustomerFace
              name={customer.name}
              face={customer.face ?? null}
              url={`${SALES_API}/customers/${String(customer.id)}/face/`}
              queryKey={customerKey(customer.id)}
              className="size-12 rounded-2xl text-xl sm:size-[60px] sm:rounded-[20px] sm:text-2xl"
              plain="bg-plum-orb"
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 font-display text-[22px] font-extrabold lg:text-[26px]">
                  {named(customer.name)}
                </h1>
                {lead && (
                  <StageChip stage={lead.stage} name={laneOf(lanesOf(customer, t), lead)?.name} />
                )}
                {lead && lead.score !== null && <ScoreChip score={lead.score} />}
              </div>
              {line.length > 0 && <span className="text-sm text-text-2">{line.join(' · ')}</span>}
            </div>
          </div>
          {/* Phones: "log" beside the side sheet, then the quick actions beside "sale". */}
          <div className="flex flex-wrap items-center gap-2.5 max-sm:grid max-sm:w-full max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-2">
            <button
              type="button"
              onClick={() => onLog('call')}
              className={buttonClass('premium', 'h-12 max-sm:order-1')}
            >
              <Icon name="phone" size={18} />
              {t('customer.log')}
            </button>
            {/* What everyone knows by its icon: chat apps by their logos, then the office ones. */}
            {/* Phones: as wide as its icons (not stretched across the row), so the groups stay together. */}
            <Dock label={t('customer.quick')} className="max-sm:order-3 max-sm:justify-self-start">
              <MessageButton customer={customer} channel="whatsapp" />
              <MessageButton customer={customer} channel="telegram" />
              <DockDivider />
              <CopyTabletLink url={customer.tablet_share_url ?? ''} iconOnly />
              <VisitButton customer={customer} onLog={() => onLog('call')} />
            </Dock>
            <NewSaleMenu onSell={onSell} onContract={onContract} />
            {side && (
              <SheetButton
                icon="user"
                label={t('side.open')}
                title={t('side.title')}
                closeLabel={t('side.close')}
                className="size-12 max-sm:order-2"
              >
                <div className="flex flex-col gap-4">{side}</div>
              </SheetButton>
            )}
          </div>
        </div>

        {/* The team's sales tags (S49): sales work, so here rather than in the shared column. */}
        {customer.supports.tags && <CustomerTags customer={customer} />}

        {lead && <NextStep customer={customer} onCall={() => onLog('call')} />}
      </div>

      {/* The board's lanes, the manager's columns included; a lost lead shows its chip instead. */}
      {lead && lead.stage !== 'lost' && <StageBar customer={customer} />}
    </section>
  );
}

/**
 * The board's lanes, the lead's one marked. A lane the card can go to is a button: it moves the
 * card on the board as a drag there would (`leads/<id>/move/`), first asking for what a team
 * column wants on entering it.
 */
function StageBar({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const user = useUser();
  const move = useMoveBoardCard();
  const [entering, setEntering] = useState<Lane | null>(null);
  const lanes = lanesOf(customer, t);
  const lead = customer.lead;
  const current = lead ? laneOf(lanes, lead) : null;
  // Moving needs the columns' ids, which Django sends with `supports.columns`.
  const targets = customer.supports.columns ? boardMoveTargets(lanes, current) : [];
  const card = { name: named(customer.name), customer: customer.id };

  function commit(to: Lane, steps?: MoveSteps) {
    if (!lead || !current) return;
    setEntering(null);
    move.mutate(
      { lead: lead.id, from: current.key, to: to.key, ...(steps && { steps }) },
      {
        onSuccess: () =>
          toast.success(t('board.move.saved', { name: named(customer.name), stage: to.name })),
        onError: () => toast.error(t('board.move.failed', { name: named(customer.name) })),
      },
    );
  }

  return (
    <>
      <StepBar
        tone="plum"
        label={t('customer.stages')}
        steps={lanes.map((lane) => ({ key: lane.key, label: lane.label }))}
        current={current ? lanes.indexOf(current) : -1}
        finished={lead?.stage === 'won'}
        {...(targets.length > 0 && {
          pick: {
            can: (index: number) => targets.includes(lanes[index] as Lane),
            label: (step: { key: string }) =>
              t('customer.moveTo', {
                stage: lanes.find((lane) => lane.key === step.key)?.name ?? '',
              }),
            onPick: (index: number) => {
              const to = lanes[index];
              if (!to || move.isPending) return;
              if (to.column === null) commit(to);
              else setEntering(to);
            },
            disabled: move.isPending,
          },
        })}
      />
      {entering && current && (
        <Suspense fallback={null}>
          <EnterStageDialog
            key={entering.key}
            card={card}
            from={current.name}
            to={{ stage: entering.stage, name: entering.name, activities: entering.activities }}
            seller={user.staff?.full_name ?? `${user.first_name} ${user.last_name}`}
            pending={move.isPending}
            onClose={() => setEntering(null)}
            onConfirm={(steps) => commit(entering, steps)}
          />
        </Suspense>
      )}
    </>
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
      className="group relative max-sm:order-4 max-sm:min-w-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <summary
        className={buttonClass(
          'outline',
          `h-12 cursor-pointer list-none max-sm:size-12 max-sm:px-0 [&::-webkit-details-marker]:hidden ${className}`,
        )}
      >
        <Icon name={icon} size={17} />
        {/* Phones: the icon alone (the label stays its name), so the quick actions fit beside it. */}
        <span className="max-sm:sr-only">{label}</span>
        <Icon
          name="chevronDown"
          size={15}
          className="transition-transform group-open:rotate-180 max-sm:hidden"
        />
      </summary>
      {/* A choice closes the menu. */}
      <div
        className="absolute end-0 top-13 z-10 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-card-sm bg-surface p-2 shadow-panel"
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('button, a')) close();
        }}
      >
        {children}
      </div>
    </details>
  );
}

/** The follow-up is a task of mine (StaffToDo): its text is what to do. */
function followUpTask(customer: CustomerData) {
  return customer.lead?.follow_up_at
    ? customer.tasks
        .filter((item) => item.kind === 'mine' && item.status !== 'done')
        .sort((a, b) => a.due_at.localeCompare(b.due_at))[0]
    : undefined;
}

/**
 * "In-person": set a meeting at the office in a free room (S75). «تماس» switches to the follow-up
 * window for the same customer (a customer with an open lead), and that one switches back.
 */
function VisitButton({ customer, onLog }: { customer: CustomerData; onLog: () => void }) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const [open, setOpen] = useState<'meeting' | 'call' | null>(null);
  const lead =
    customer.lead && !['won', 'lost'].includes(customer.lead.stage) ? customer.lead : null;
  const task = followUpTask(customer);
  const logInstead = () => {
    setOpen(null);
    onLog();
  };
  return (
    <>
      <IconButton
        icon="building"
        onClick={() => setOpen('meeting')}
        aria-label={t('visit.openAria', { name: named(customer.name) })}
        tip={t('visit.open')}
      />
      {open === 'meeting' && (
        <Suspense fallback={null}>
          <VisitDialog
            open
            customer={customer}
            onClose={() => setOpen(null)}
            followUp={
              customer.lead?.follow_up_at
                ? { at: customer.lead.follow_up_at, text: task?.text, timed: task?.timed }
                : null
            }
            onLog={logInstead}
            {...(lead ? { onCall: () => setOpen('call') } : {})}
          />
        </Suspense>
      )}
      {open === 'call' && lead && (
        <Suspense fallback={null}>
          <FollowUpDialog
            open
            onClose={() => setOpen(null)}
            at={lead.follow_up_at ? new Date(lead.follow_up_at) : null}
            lead={{ id: lead.id, name: named(customer.name), customer: customer.id }}
            current={task?.text}
            timed={task?.timed}
            onLog={logInstead}
          />
        </Suspense>
      )}
    </>
  );
}

/**
 * "Message": WhatsApp or Telegram with the customer's chat. With ready messages it first asks which
 * one to type in (the seller's own first, or none); without any it opens the app in one click.
 * Without a mobile number no app opens: the picker offers the texts to copy instead.
 * SMS and logging a message stay in the contact log ("Log a contact").
 */
function MessageButton({
  customer,
  channel,
}: {
  customer: CustomerData;
  channel: 'whatsapp' | 'telegram';
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const [picking, setPicking] = useState(false);
  const label = t('messageTo', { channel: t(`channel.${channel}`), name: named(customer.name) });
  const look = { icon: CHANNEL_ICON[channel], tone: channel, iconSize: 21 } as const;
  if (customer.templates.length === 0) {
    const href = messageHref(channel, customer.phone);
    // No mobile number and no ready message: nothing to open or copy.
    if (!href)
      return (
        <IconButton {...look} disabled aria-label={label} tip={t('whatsAppPicker.noPhoneShort')} />
      );
    return (
      <IconLink
        {...look}
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={label}
        tip={t(`channel.${channel}`)}
      />
    );
  }
  return (
    <>
      <IconButton
        {...look}
        aria-label={label}
        aria-haspopup="dialog"
        tip={t(`channel.${channel}`)}
        onClick={() => setPicking(true)}
      />
      {picking && (
        <Suspense fallback={null}>
          <WhatsAppPicker customer={customer} channel={channel} onClose={() => setPicking(false)} />
        </Suspense>
      )}
    </>
  );
}

/** The dark strip: the one thing to do next (the follow-up), with "log it" and "another time". */
function NextStep({ customer, onCall }: { customer: CustomerData; onCall: () => void }) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
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
  const task = followUpTask(customer);
  const label = t(first ? 'next.first' : lost ? 'next.lost' : 'next.label');

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[20px] px-4 py-3.5 text-on-hero shadow-luxe bg-luxe-soft lg:px-5">
      <span className="flex min-w-0 flex-[1_1_220px] items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-10 flex-none items-center justify-center rounded-xl bg-luxe-gold"
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
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--luxe-line)] hover:bg-hero-raised"
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
            lead={{ id: lead.id, name: named(customer.name), customer: customer.id }}
            current={task?.text}
            timed={task?.timed}
            onLog={() => {
              setMoving(false);
              onCall();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/** "Sale ▾": sell a product now, or prepare a contract offer. */
function NewSaleMenu({ onSell, onContract }: { onSell: () => void; onContract: () => void }) {
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
        <button type="button" className={item} onClick={onContract}>
          <span className="font-semibold">{t('customer.newSale.offer')}</span>
          <span className="text-xs leading-5 font-normal text-text-2">
            {t('customer.newSale.offerHint')}
          </span>
        </button>
      </>
    </Menu>
  );
}
