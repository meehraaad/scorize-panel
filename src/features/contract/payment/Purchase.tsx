import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  useApplyCode,
  useStartOnlinePayment,
  useUseCredit,
  type DiscountResult,
  type PaymentData,
} from '../api';
import { ReceiptForm } from '../components/ReceiptForm';
import { itemPrice, useItemNote, useMinutesLeft, useMoney } from './money';
import { Collapsible, Dock, ItemRows, Row } from './parts';

type Stage = 'buy' | 'receipt' | 'vpn';

/**
 * The purchase screen for one or several items (canvas "Scorize Payment States" A1/DA1): the items
 * and the amount fold away, the discount code and the wallet credit change the price until the bank
 * (A7), then the bank, or card transfer instead. The bank opens only from Iran (A6); while leaving
 * for it, or when it doesn't answer, the button says so (A5).
 */
export function Purchase({
  payment,
  toman,
  receipt,
}: {
  payment: PaymentData;
  toman: boolean;
  /** Opens on card transfer (a currency the bank can't take, or `?method=receipt`). */
  receipt: boolean;
}) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(payment.currency);
  const noteOf = useItemNote();
  const left = useMinutesLeft(payment);
  const start = useStartOnlinePayment();
  const [stage, setStage] = useState<Stage>(receipt ? 'receipt' : 'buy');
  const [vpnTarget, setVpnTarget] = useState<string | null>(null);
  const [down, setDown] = useState(false);
  // Stays "redirecting" after success: the browser is leaving for the bank.
  const leaving = start.isPending || (start.isSuccess && stage === 'buy');

  const pay = () => {
    setDown(false);
    start.mutate(payment.id, {
      onSuccess: ({ redirect_url, outside_iran }) => {
        if (outside_iran) {
          setVpnTarget(redirect_url);
          setStage('vpn');
        } else window.location.assign(redirect_url);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 503) setDown(true);
        else toast.error(t('payment.onlineError'));
      },
    });
  };

  if (stage === 'vpn' && vpnTarget)
    return (
      <OutsideIran
        payment={payment}
        target={vpnTarget}
        onReceipt={() => setStage('receipt')}
        onBack={() => setStage('buy')}
      />
    );

  const [first] = payment.items;
  const several = payment.items.length > 1;
  const subtotal = payment.items.reduce((sum, item) => sum + itemPrice(item), 0);
  const saved = payment.admin_discount + (payment.code?.discount ?? 0);
  const summary = [
    saved > 0 && t('payment.buy.saved', { amount: f.number(saved) }),
    payment.credit_used > 0 &&
      t('payment.buy.creditShort', { amount: f.number(payment.credit_used) }),
    payment.tax > 0 && t('payment.buy.withTax'),
    payment.editable && t('payment.buy.codeAndCredit'),
  ].filter((part): part is string => typeof part === 'string');

  return (
    <>
      <PageHeader
        title={t('payment.buy.title')}
        subtitle={
          payment.seller ? t('payment.buy.fromSeller', { name: payment.seller }) : undefined
        }
        actions={
          left !== null && (
            <span className="inline-flex items-center gap-1 text-[13px] whitespace-nowrap text-warn">
              <Icon name="clock" size={15} />
              {t('payment.buy.minutesLeft', { minutes: f.number(left) })}
            </span>
          )
        }
      />
      {!toman && <Notice tone="info">{t('payment.buy.foreign')}</Notice>}

      <Collapsible
        title={
          several
            ? t('payment.buy.items', { n: f.number(payment.items.length) })
            : (first?.label ?? '')
        }
        summary={
          several
            ? f.list(payment.items.map((item) => item.label))
            : first && (noteOf(first) ?? undefined)
        }
        amount={money(subtotal)}
      >
        <ItemRows payment={payment} />
      </Collapsible>

      <Collapsible
        title={t('payment.amount')}
        summary={summary.join(' · ') || undefined}
        amount={money(payment.amount)}
        big
      >
        {payment.editable && <CodeRow payment={payment} />}
        {payment.editable && (payment.wallet ?? 0) + payment.credit_used > 0 && (
          <CreditRow payment={payment} />
        )}
        <Breakdown payment={payment} />
      </Collapsible>

      {stage === 'receipt' ? (
        <ReceiptForm payment={payment} onOnline={toman ? () => setStage('buy') : undefined} />
      ) : (
        <>
          {down && (
            <Notice tone="error">
              <span className="flex flex-col gap-1">
                <span>{t('payment.buy.bankDown')}</span>
                <span className="text-text-2">{t('payment.buy.notCharged')}</span>
              </span>
            </Notice>
          )}
          <Button
            variant="outline"
            className="self-center"
            disabled={leaving}
            onClick={() => setStage('receipt')}
          >
            {t('payment.toReceipt')}
          </Button>
          <Dock>
            <Button size="lg" shape="rounded" disabled={leaving} onClick={pay}>
              {leaving
                ? t('payment.redirecting')
                : down
                  ? t('payment.buy.retry')
                  : t('payment.buy.pay', { amount: money(payment.amount) })}
            </Button>
            {leaving ? (
              <span className="text-center text-[13px] text-text-2">
                {t('payment.buy.dontClose')}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5 text-[13px] text-text-2">
                <Icon name="shield" size={16} />
                {t('payment.gateway')}
              </span>
            )}
          </Dock>
        </>
      )}
    </>
  );
}

/** Where the amount comes from: list price, discounts, tax, credit, the bank's minimum. */
function Breakdown({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const money = useMoney(payment.currency);
  const lines: [string, string, boolean][] = [
    [t('payment.buy.original'), money(payment.original), false],
  ];
  if (payment.admin_discount > 0)
    lines.push([t('payment.buy.adminDiscount'), `−${money(payment.admin_discount)}`, true]);
  if (payment.code && payment.code.discount > 0)
    lines.push([
      t('payment.buy.codeLine', { code: payment.code.code }),
      `−${money(payment.code.discount)}`,
      true,
    ]);
  if (payment.tax > 0) lines.push([t('payment.buy.tax'), `+${money(payment.tax)}`, false]);
  if (payment.credit_used > 0)
    lines.push([t('payment.credit'), `−${money(payment.credit_used)}`, true]);
  if (payment.adjustment > 0)
    lines.push([t('payment.buy.minimum'), `+${money(payment.adjustment)}`, false]);
  else if (payment.adjustment < 0)
    lines.push([t('payment.buy.sellerPrice'), `−${money(-payment.adjustment)}`, true]);

  return (
    <dl className="m-0">
      {lines.map(([label, value, cut]) => (
        <Row key={label}>
          <dt className="text-text-2">{label}</dt>
          <dd className={`m-0 tabular-nums ${cut ? 'text-good' : ''}`}>{value}</dd>
        </Row>
      ))}
    </dl>
  );
}

/** The discount code: applied (with remove) or a field to add one, and why one didn't apply (A7). */
function CodeRow({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const apply = useApplyCode();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<Exclude<DiscountResult, 'ok'> | null>(null);

  const send = (code: string) =>
    apply.mutate(
      { id: payment.id, code },
      {
        onSuccess: ({ result: answer }) => {
          if (answer === 'ok') {
            setResult(null);
            setOpen(false);
            setValue('');
            toast.success(t(code ? 'payment.code.applied' : 'payment.code.removed'));
          } else setResult(answer);
        },
        onError: () => toast.error(t('payment.code.error')),
      },
    );
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (value.trim()) send(value.trim());
  };

  if (payment.code)
    return (
      <Row>
        <span className="text-text-2">{t('payment.code.label')}</span>
        <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-good-tint ps-2.5 text-xs font-bold text-good">
          <span dir="ltr">{payment.code.code}</span>
          <button
            type="button"
            disabled={apply.isPending}
            aria-label={t('payment.code.remove')}
            onClick={() => send('')}
            className="flex size-11 items-center justify-center rounded-full"
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      </Row>
    );

  if (!open)
    return (
      <Row>
        <span className="text-text-2">{t('payment.code.label')}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 font-semibold text-primary-text"
        >
          {t('payment.code.add')}
        </button>
      </Row>
    );

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex flex-col gap-2 px-5 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:px-[26px]"
    >
      <span className="text-sm text-text-2">{t('payment.code.label')}</span>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            id="payment-code"
            label={t('payment.code.label')}
            hideLabel
            value={value}
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            error={result ? t(`payment.code.result.${result}`) : undefined}
            hint={result ? undefined : t('payment.code.hint')}
            onChange={(event) => {
              setValue(event.target.value);
              setResult(null);
            }}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          className="h-12"
          disabled={apply.isPending || !value.trim()}
        >
          {apply.isPending ? t('payment.code.checking') : t('payment.code.apply')}
        </Button>
      </div>
    </form>
  );
}

/** The wallet credit switch: what it takes off, or the balance when off. */
function CreditRow({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const money = useMoney(payment.currency);
  const credit = useUseCredit();
  const balance = (payment.wallet ?? 0) + payment.credit_used;

  return (
    <div className="px-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-[22px]">
      <Switch
        label={t('payment.wallet.label')}
        description={
          payment.use_credit
            ? t('payment.wallet.using', {
                used: money(payment.credit_used),
                balance: money(balance),
              })
            : t('payment.wallet.balance', { balance: money(balance) })
        }
        checked={payment.use_credit}
        disabled={credit.isPending}
        onChange={(use) =>
          credit.mutate(
            { id: payment.id, use },
            { onError: () => toast.error(t('payment.wallet.error')) },
          )
        }
      />
    </div>
  );
}

/** The bank opens only from Iran: turn off the VPN, then go (A6); abroad, card transfer. */
function OutsideIran({
  payment,
  target,
  onReceipt,
  onBack,
}: {
  payment: PaymentData;
  target: string;
  onReceipt: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(payment.currency);
  const steps = [t('payment.vpn.step1'), t('payment.vpn.step2'), t('payment.vpn.step3')];

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] text-text-2"
      >
        <Icon name="chevronStart" size={16} />
        {t('payment.vpn.back')}
      </button>
      <Card className="flex flex-col gap-4 p-5 lg:p-[26px]">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-warn-tint text-warn"
        >
          <Icon name="shield" size={26} />
        </span>
        <h1 className="m-0 text-xl font-bold">{t('payment.vpn.title')}</h1>
        <p className="m-0 text-sm leading-7 text-text-2">{t('payment.vpn.text')}</p>
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2.5 text-sm">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-tint font-bold text-primary-text">
                {f.number(index + 1)}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-2">{t('payment.amount')}</span>
          <b className="tabular-nums">{money(payment.amount)}</b>
        </div>
        <a href={target} className={buttonClass('primary', '', 'lg', 'rounded')}>
          {t('payment.vpn.go')}
        </a>
        <Button variant="outline" onClick={onReceipt}>
          {t('payment.vpn.abroad')}
        </Button>
        <p className="m-0 text-[13px] text-text-2">{t('payment.vpn.anyCard')}</p>
      </Card>
    </>
  );
}
