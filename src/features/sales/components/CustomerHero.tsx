import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { StepBar } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { initialOf } from '@/lib/text';
import { MESSAGE_CHANNELS, STAGES, maskPhone, type Channel } from '@/lib/sales/api';
import type { CustomerData } from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';
import { ScoreChip, StageChip } from './LeadChips';

/** Stages on the bar (a lost lead shows its chip instead of a step). */
const BAR = STAGES.filter((stage) => stage !== 'lost');

const raised =
  'inline-flex h-11 items-center gap-2 rounded-full bg-hero-raised px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-line';

/** The dark card on top of the customer page: who, where they are, and how to reach them. */
export function CustomerHero({
  customer,
  onLog,
  onSell,
}: {
  customer: CustomerData;
  onLog: (channel: Channel) => void;
  /** Opens the product sale. */
  onSell: () => void;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const s = useSalesFormat();
  const { lead, headline } = customer;

  const line = [
    [headline.degree !== null ? tc(`degree.${headline.degree}`) : '', headline.field ?? '']
      .join(' ')
      .trim(),
    headline.countries.length ? f.list(headline.countries) : '',
    headline.budget ? t('customer.budget', { budget: headline.budget }) : '',
  ].filter(Boolean);
  const contact = [
    f.digits(maskPhone(customer.phone)),
    customer.email,
    lead &&
      t('customer.meta', {
        source: t(`source.${lead.source}`),
        seller: lead.seller ?? t('due.none'),
      }),
  ].filter(Boolean);
  const due = lead && s.due(lead.follow_up_at, lead.stage, lead.stage !== 'new');

  return (
    <section
      aria-label={t('customer.summary')}
      className="flex flex-col gap-6 rounded-card-sm bg-hero p-5 text-on-hero shadow-hero lg:rounded-[32px] lg:px-9 lg:py-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-14 flex-none items-center justify-center rounded-full bg-hero-raised text-xl font-bold"
          >
            {initialOf(customer.name)}
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="m-0 font-display text-2xl font-bold lg:text-[28px]">
                {customer.name}
              </h1>
              {lead && <ScoreChip score={lead.score} />}
              {lead && <StageChip stage={lead.stage} />}
            </div>
            {line.length > 0 && (
              <span className="text-[15px] text-on-hero-2">{line.join(' · ')}</span>
            )}
            <span className="text-sm text-on-hero-2">{contact.join(' · ')}</span>
          </div>
        </div>
        {lead && (
          <div className="flex flex-col gap-1 rounded-2xl bg-hero-raised px-4 py-3">
            <span className="text-xs text-on-hero-2">{t('customer.followUp')}</span>
            <span className={`text-base font-bold ${due?.urgent ? 'text-hero-current' : ''}`}>
              {lead.stage === 'lost' && lead.lost_reason
                ? t('customer.lostBecause', { reason: t(`lost.${lead.lost_reason}`) })
                : lead.follow_up_at || lead.stage === 'new'
                  ? due?.text
                  : t('customer.noFollowUp')}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onLog('call')}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-on-hero px-5 text-[15px] font-semibold text-hero"
        >
          <Icon name="phone" size={18} />
          {t('customer.log')}
        </button>
        {MESSAGE_CHANNELS.map((channel) => (
          <button key={channel} type="button" onClick={() => onLog(channel)} className={raised}>
            <Icon name={channel === 'sms' ? 'chat' : 'send'} size={16} />
            {t(`channel.${channel}`)}
          </button>
        ))}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-hero-line sm:block" />
        <NewSaleMenu customer={customer.id} onSell={onSell} />
      </div>

      {lead && lead.stage !== 'lost' && (
        <StepBar
          label={t('customer.stages')}
          tone="onHero"
          steps={BAR.map((stage) => ({ key: stage, label: t(`stageShort.${stage}`) }))}
          current={BAR.indexOf(lead.stage)}
          finished={lead.stage === 'won'}
        />
      )}
    </section>
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
      <summary className={`${raised} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <Icon name="plus" size={16} />
        {t('customer.newSale.label')}
        <Icon name="chevronDown" size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute start-0 top-12 z-10 flex w-72 flex-col gap-1 rounded-card-sm bg-surface p-2 shadow-panel">
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
