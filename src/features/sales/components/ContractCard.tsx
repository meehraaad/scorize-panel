import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { StepBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { handoffQuery, offerQuery, type OfferStatus } from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';

type CardState = OfferStatus['state'] | 'approved';
type Step = 'made' | 'customer' | 'manager' | 'returned' | 'resend' | 'sign' | 'case';
type Act = 'continue' | 'edit' | 'fix' | 'print' | 'scan' | 'preview';

const TONE: Record<CardState, ChipTone> = {
  saved: 'neutral',
  sent: 'info',
  submitted: 'warn',
  returned: 'danger',
  approved: 'good',
};

/** The contract's way from this state: its steps and which one it is on. */
const WAY: Record<CardState, { steps: Step[]; current: number }> = {
  saved: { steps: ['made', 'manager', 'sign'], current: 0 },
  sent: { steps: ['made', 'customer', 'manager', 'sign'], current: 1 },
  submitted: { steps: ['made', 'manager', 'sign'], current: 1 },
  returned: { steps: ['made', 'returned', 'resend', 'sign'], current: 1 },
  approved: { steps: ['made', 'manager', 'sign', 'case'], current: 2 },
};

/**
 * The customer's contract on their page (S71, canvas "قرارداد تازه · وضعیت روی صفحه‌ی مشتری"):
 * the open offer (a draft, sent to the customer, waiting for the manager, or returned with the
 * manager's note), or the approved contract until its case starts, each with what to do next.
 * Nothing shows without either.
 */
export function ContractCard({ customer }: { customer: number }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const { data: offer } = useSuspenseQuery(offerQuery(customer));
  const { data: handoff } = useSuspenseQuery(handoffQuery(customer));
  const open = offer.status;
  const approved = !open && handoff.contract !== null && handoff.contract.state !== 'active';
  if (!open && !approved) return null;

  const state: CardState = open ? open.state : 'approved';
  const base = customerPath(customer);
  const edit = `${base}/offer`;
  const preview = `${base}/offer?step=4`;
  const [main, second]: [[Act, string], [Act, string]] =
    state === 'approved'
      ? [
          ['print', `${base}/contract`],
          ['scan', `${base}/apply`],
        ]
      : state === 'submitted'
        ? [
            ['preview', preview],
            ['edit', edit],
          ]
        : [
            [state === 'returned' ? 'fix' : state === 'sent' ? 'edit' : 'continue', edit],
            ['preview', preview],
          ];
  const way = WAY[state];

  return (
    <SectionCard
      id="contract-card"
      variant="panel"
      size="lg"
      title={open ? t('contractCard.title', { name: open.name }) : t('contractCard.approvedTitle')}
      end={
        <Chip tone={TONE[state]} small>
          {t(`contractCard.state.${state}`)}
        </Chip>
      }
    >
      <p className="m-0 text-[15px] leading-8 text-text-2">{t(`contractCard.text.${state}`)}</p>
      {open?.state === 'returned' && offer.comment && (
        <Notice tone="error">
          <b>
            {open.reviewer
              ? t('contractCard.comment', { name: open.reviewer })
              : t('contractCard.commentNoName')}
          </b>{' '}
          {offer.comment}
        </Notice>
      )}
      <StepBar
        label={t('contractCard.steps')}
        steps={way.steps.map((key) => ({ key, label: t(`contractCard.${key}`) }))}
        current={way.current}
        tone="plum"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Link to={main[1]} className={buttonClass('primary')}>
            {t(`contractCard.act.${main[0]}`)}
          </Link>
          <Link to={second[1]} className={buttonClass('outline')}>
            {t(`contractCard.act.${second[0]}`)}
          </Link>
        </div>
        {open && (
          <span className="text-sm text-text-2">
            {t('contractCard.amount')}:{' '}
            <b className="text-text tabular-nums">
              {open.amount ? s.exact(open.amount, open.currency ?? 'IRT') : t('contractCard.free')}
            </b>{' '}
            · {f.timeAgo(open.updated_at)}
          </span>
        )}
      </div>
    </SectionCard>
  );
}
