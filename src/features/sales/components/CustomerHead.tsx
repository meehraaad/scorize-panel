import { lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomerFace } from '@/components/customers/CustomerFace';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon, type IconName } from '@/components/ui/Icon';
import { StepBar } from '@/components/ui/Progress';
import { SheetButton } from '@/components/ui/Sheet';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { messageHref, SALES_API, type Channel } from '@/lib/sales/api';
import { customerKey, useMoveBoardCard, type CustomerData, type MoveSteps } from '../api';
import { boardMoveTargets, laneOf, lanesOf, type Lane } from '../boardLanes';
import { useSalesFormat } from '../format';
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
                  {customer.name}
                </h1>
                {lead && (
                  <StageChip stage={lead.stage} name={laneOf(lanesOf(customer, t), lead)?.name} />
                )}
                {lead && lead.score !== null && <ScoreChip score={lead.score} />}
              </div>
              {line.length > 0 && <span className="text-sm text-text-2">{line.join(' · ')}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-[1fr_1fr_auto]">
            <button
              type="button"
              onClick={() => onLog('call')}
              className={buttonClass('premium', 'h-13 max-sm:col-span-2', 'lg')}
            >
              <Icon name="phone" size={19} />
              {t('customer.log')}
            </button>
            <VisitButton customer={customer} />
            <WhatsAppButton customer={customer} />
            <NewSaleMenu onSell={onSell} onContract={onContract} />
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
  const user = useUser();
  const move = useMoveBoardCard();
  const [entering, setEntering] = useState<Lane | null>(null);
  const lanes = lanesOf(customer, t);
  const lead = customer.lead;
  const current = lead ? laneOf(lanes, lead) : null;
  // Moving needs the columns' ids, which Django sends with `supports.columns`.
  const targets = customer.supports.columns ? boardMoveTargets(lanes, current) : [];
  const card = { name: customer.name, customer: customer.id };

  function commit(to: Lane, steps?: MoveSteps) {
    if (!lead || !current) return;
    setEntering(null);
    move.mutate(
      { lead: lead.id, from: current.key, to: to.key, ...(steps && { steps }) },
      {
        onSuccess: () =>
          toast.success(t('board.move.saved', { name: customer.name, stage: to.name })),
        onError: () => toast.error(t('board.move.failed', { name: customer.name })),
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

/** "In-person": set a meeting at the office in a free room (S75). */
function VisitButton({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('visit.openAria', { name: customer.name })}
        className={buttonClass('outline', 'h-13 max-sm:min-w-0 max-sm:px-4', 'lg')}
      >
        <Icon name="building" size={17} />
        <span className="max-sm:sr-only">{t('visit.open')}</span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <VisitDialog open customer={customer} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

/**
 * "Message": opens WhatsApp with the customer's chat and the first ready message (S7) typed in,
 * in one click. Telegram, SMS and logging a message stay in the contact log ("Log a contact").
 */
function WhatsAppButton({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  return (
    <a
      href={messageHref('whatsapp', customer.phone, customer.templates[0]?.text)}
      target="_blank"
      rel="noreferrer"
      aria-label={t('messageTo', { channel: t('channel.whatsapp'), name: customer.name })}
      className={buttonClass('outline', 'h-13 max-sm:min-w-0 max-sm:px-4', 'lg')}
    >
      <Icon name="send" size={17} />
      {t('channel.whatsapp')}
    </a>
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
            lead={{ id: lead.id, name: customer.name }}
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
