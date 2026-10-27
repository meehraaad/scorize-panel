import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { activitiesQuery, type Activity } from '@/lib/applicant/activities';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { safeHref } from '@/lib/url';
import {
  useRenewPayment,
  useStartOnlinePayment,
  type PaymentData,
  type PaymentItem,
  type PaymentItemKind,
} from '../api';
import { ReceiptForm } from '../components/ReceiptForm';
import { useMoney } from './money';
import { Collapsible, Facts, Hero, ItemRows } from './parts';

/** Where each kind of purchase lives once bought, and the icon of its next step. */
const NEXT: Partial<Record<PaymentItemKind, IconName>> = {
  consultation: 'calendar',
  writing: 'document',
  package: 'play',
  webinar: 'video',
  campaign: 'phone',
  instalment: 'card',
};

/**
 * Paid (canvas B1/DB1, B3): what was paid, then what is left to do for each item (the to-dos the
 * purchase opened, from the to-do box's list) and where each item lives now.
 */
export function Result({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(payment.currency);
  const { data: activities } = useQuery({ ...activitiesQuery, enabled: ON_SERVER.activities });
  const todos = (activities ?? []).filter((item) => payment.activities.includes(item.id));
  const byCredit = payment.amount === 0 && payment.credit_used > 0;
  const firstTodo = todos.find((item) => item.required) ?? todos[0];
  const links = payment.items.filter(
    (item): item is PaymentItem & { href: string } => item.href !== null,
  );
  const facts: [string, ReactNode][] = [];
  if (payment.credit_used > 0) facts.push([t('payment.credit'), `−${money(payment.credit_used)}`]);
  facts.push([
    t('payment.method'),
    t(`payment.methodName.${byCredit ? 'credit' : (payment.method ?? 'online')}`),
  ]);
  if (payment.ref_id)
    facts.push([t('payment.result.ref'), <span dir="ltr">{f.digits(payment.ref_id)}</span>]);
  if (payment.paid_at) facts.push([t('payment.paidAt'), f.dateTime(payment.paid_at)]);
  const title = byCredit
    ? t('payment.result.byCredit')
    : payment.method === 'receipt'
      ? t('payment.result.receiptAccepted')
      : t('payment.result.paid');

  return (
    <>
      <Hero icon="check" tone="good" title={title}>
        <p className="m-0 text-sm text-text-2">{f.list(payment.items.map((item) => item.label))}</p>
        {byCredit && <p className="m-0 text-sm text-text-2">{t('payment.result.byCreditText')}</p>}
      </Hero>

      <Collapsible title={t('payment.result.details')} amount={money(payment.amount)}>
        <ItemRows payment={payment} />
        <Facts facts={facts} />
      </Collapsible>

      <SectionCard
        id="payment-next"
        size="md"
        title={todos.length ? t('payment.result.next') : t('payment.result.after')}
        end={
          <span className="text-[13px] text-text-2">
            {todos.length
              ? t('payment.result.todoCount', { n: f.number(todos.length) })
              : t('payment.result.nothing')}
          </span>
        }
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {todos.map((todo) => (
            <TodoRow key={todo.id} todo={todo} primary={todo === firstTodo} />
          ))}
          {links.map((item) => (
            <li key={`${item.kind}-${item.href}`} className="shadow-[inset_0_1px_0_var(--hair)]">
              <Link
                to={item.href}
                className="flex min-h-14 items-center gap-3 px-5 py-3 lg:px-[26px]"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
                >
                  <Icon name={NEXT[item.kind] ?? 'check'} size={20} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[13px] text-text-2">
                    {t(`payment.result.kind.${item.kind}`)}
                  </span>
                </span>
                <Icon name="chevronEnd" size={18} className="text-text-2" />
              </Link>
            </li>
          ))}
        </ul>
        {todos.length > 0 && (
          <p className="m-0 px-5 pt-1 pb-4 text-[13px] leading-6 text-text-2 lg:px-[26px]">
            {t('payment.result.later')}
          </p>
        )}
      </SectionCard>

      {payment.reward > 0 && (
        <Notice tone="success">
          {t('payment.result.reward', { amount: money(payment.reward) })}
        </Notice>
      )}
      {!firstTodo && (
        <Link to="/" className={buttonClass('outline', 'self-center')}>
          {t('payment.result.home')}
        </Link>
      )}
    </>
  );
}

/** One to-do the purchase left: its title, what it needs, and its page. */
function TodoRow({ todo, primary }: { todo: Activity; primary: boolean }) {
  const { t } = useTranslation('contract');
  const href = todo.payload.href;
  const url = safeHref(todo.payload.url);
  const action = href ? (
    <Link to={href} className={buttonClass(primary ? 'primary' : 'outline', 'self-start')}>
      {t('payment.result.open')}
    </Link>
  ) : url ? (
    <a href={url} className={buttonClass(primary ? 'primary' : 'outline', 'self-start')}>
      {t('payment.result.open')}
    </a>
  ) : null;

  return (
    <li className="flex gap-3 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-[26px]">
      <span
        aria-hidden="true"
        className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
      >
        <Icon name="formMissing" size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{todo.title}</span>
          <Chip tone={todo.required ? 'warn' : 'neutral'} small>
            {t(todo.required ? 'payment.result.required' : 'payment.result.optional')}
          </Chip>
        </span>
        {todo.text && <span className="text-[13px] leading-6 text-text-2">{todo.text}</span>}
        {action}
      </span>
    </li>
  );
}

/** Buys it again: a new invoice here, a request to the seller, or its own page. */
function useRenew(payment: PaymentData) {
  const { t } = useTranslation('contract');
  const navigate = useNavigate();
  const renew = useRenewPayment();
  const go = (method?: 'receipt') =>
    renew.mutate(payment.id, {
      onSuccess: ({ payment_id }) => {
        if (payment_id === null) toast.success(t('payment.renew.asked'));
        else void navigate(`/payments/${String(payment_id)}${method ? '?method=receipt' : ''}`);
      },
      onError: () => toast.error(t('payment.renew.error')),
    });
  return { go, pending: renew.isPending };
}

/** Where to book a session or a campaign again. */
function rebookPath(payment: PaymentData) {
  const item = payment.items.find((one) => one.kind === 'campaign' || one.kind === 'consultation');
  if (item?.kind === 'campaign' && item.href) return item.href;
  return '/consultations/book';
}

/** Failed or cancelled at the bank (B4): nothing was bought; pay again or by card transfer. */
export function Failed({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const money = useMoney(payment.currency);
  const renew = useRenew(payment);

  return (
    <>
      <Hero icon="alert" tone="danger" title={t('payment.failed.title')}>
        <p className="m-0 text-sm leading-7 text-text-2">{t('payment.failed.text')}</p>
      </Hero>
      <Notice tone="info">{t('payment.failed.refund')}</Notice>
      <Again
        payment={payment}
        renew={renew}
        label={t('payment.failed.again', { amount: money(payment.amount) })}
      />
      <Collapsible title={t('payment.items')} amount={money(payment.amount)}>
        <ItemRows payment={payment} />
      </Collapsible>
      <Link to="/tickets" className={buttonClass('outline', 'self-center')}>
        {t('payment.failed.support')}
      </Link>
    </>
  );
}

/** The invoice expired (B5): a new one at today's price, from the seller, or booked again. */
export function Expired({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(payment.currency);
  const renew = useRenew(payment);

  return (
    <>
      <Hero icon="clock" tone="warn" title={t('payment.expired.title')}>
        <p className="m-0 text-sm leading-7 text-text-2">{t('payment.expired.text')}</p>
      </Hero>
      <Again
        payment={payment}
        renew={renew}
        label={t('payment.expired.again', { amount: money(payment.amount) })}
      />
      <Collapsible title={t('payment.items')} amount={money(payment.amount)}>
        <ItemRows payment={payment} />
        <Facts facts={[[t('payment.created'), f.dateTime(payment.created_at)]]} />
      </Collapsible>
    </>
  );
}

/** The way back to paying, by how this purchase is renewed. */
function Again({
  payment,
  renew,
  label,
}: {
  payment: PaymentData;
  renew: ReturnType<typeof useRenew>;
  label: string;
}) {
  const { t } = useTranslation('contract');
  if (payment.renew === 'rebook')
    return (
      <Card className="flex flex-col gap-2 p-5 lg:p-[26px]">
        <Link to={rebookPath(payment)} className={buttonClass('primary', '', 'lg', 'rounded')}>
          {t('payment.renew.rebook')}
        </Link>
        <span className="text-center text-[13px] text-text-2">{t('payment.renew.rebookText')}</span>
      </Card>
    );
  if (payment.renew === 'seller')
    return (
      <Card className="flex flex-col gap-2 p-5 lg:p-[26px]">
        <Button size="lg" shape="rounded" disabled={renew.pending} onClick={() => renew.go()}>
          {t('payment.renew.askSeller', { name: payment.seller ?? '' })}
        </Button>
        <span className="text-center text-[13px] text-text-2">{t('payment.renew.sellerText')}</span>
      </Card>
    );
  if (payment.renew !== 'self') return null;
  return (
    <Card className="flex flex-col gap-2 p-5 lg:p-[26px]">
      <Button size="lg" shape="rounded" disabled={renew.pending} onClick={() => renew.go()}>
        {label}
      </Button>
      <span className="text-center text-[13px] text-text-2">{t('payment.renew.today')}</span>
      <Button variant="outline" disabled={renew.pending} onClick={() => renew.go('receipt')}>
        {t('payment.toReceipt')}
      </Button>
    </Card>
  );
}

/** The bank didn't answer after paying: the sales team checks it (PAY9). */
export function Checking({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const money = useMoney(payment.currency);
  return (
    <>
      <Hero icon="clock" tone="info" title={t('payment.checking.title')}>
        <p className="m-0 text-sm leading-7 text-text-2">{t('payment.checking.text')}</p>
      </Hero>
      <Collapsible title={t('payment.items')} amount={money(payment.amount)}>
        <ItemRows payment={payment} />
      </Collapsible>
    </>
  );
}

/** A receipt waiting for the sales team (C2): where it is in the review. */
export function InReview({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(payment.currency);
  const receipt = payment.receipt;
  const steps: [string, string | null, boolean][] = [
    [t('payment.review.uploaded'), receipt ? f.dateTime(receipt.uploaded_at) : null, true],
    [t('payment.review.team'), t('payment.review.sameDay'), false],
    [t('payment.review.active'), null, false],
  ];

  return (
    <>
      <Hero icon="clock" tone="info" title={t('payment.review.title')}>
        <p className="m-0 text-sm leading-7 text-text-2">{t('payment.review.text')}</p>
      </Hero>
      <Card className="flex flex-col gap-3 p-5 lg:p-[26px]">
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {steps.map(([label, line, done]) => (
            <li key={label} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-6 flex-none items-center justify-center rounded-full ${done ? 'bg-good-tint text-good' : 'bg-neutral-tint text-text-2'}`}
              >
                <Icon name={done ? 'check' : 'clock'} size={14} />
              </span>
              <span className="flex flex-col">
                <span className="font-medium">{label}</span>
                {line && <span className="text-[13px] text-text-2">{line}</span>}
              </span>
            </li>
          ))}
        </ol>
        {receipt && (
          <a
            href={safeHref(receipt.url)}
            target="_blank"
            rel="noopener"
            className={buttonClass('outline')}
          >
            {t('payment.review.view')}
          </a>
        )}
      </Card>
      <Collapsible title={t('payment.items')} amount={money(payment.amount)}>
        <ItemRows payment={payment} />
      </Collapsible>
    </>
  );
}

/** The receipt was declined (C3): why, the previous one, a new receipt or the bank instead. */
export function Declined({ payment, toman }: { payment: PaymentData; toman: boolean }) {
  const { t } = useTranslation('contract');
  const money = useMoney(payment.currency);
  const start = useStartOnlinePayment();

  return (
    <>
      <Notice tone="error">
        <span className="flex flex-col gap-1">
          <span className="font-bold">{t('payment.declined.title')}</span>
          <span className="text-text">
            {[payment.decline_reason, t('payment.declined.text')].filter(Boolean).join(' ')}
          </span>
        </span>
      </Notice>
      {payment.receipt && (
        <a
          href={safeHref(payment.receipt.url)}
          target="_blank"
          rel="noopener"
          className={buttonClass('outline', 'self-start')}
        >
          {t('payment.declined.previous')}
        </a>
      )}
      <Collapsible title={t('payment.items')} amount={money(payment.amount)}>
        <ItemRows payment={payment} />
      </Collapsible>
      <ReceiptForm
        payment={payment}
        onOnline={
          toman
            ? () =>
                start.mutate(payment.id, {
                  onSuccess: ({ redirect_url }) => window.location.assign(redirect_url),
                  onError: () => toast.error(t('payment.onlineError')),
                })
            : undefined
        }
      />
    </>
  );
}
