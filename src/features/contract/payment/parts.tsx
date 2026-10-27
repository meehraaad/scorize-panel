import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import type { PaymentData } from '../api';
import { itemPrice, useItemNote, useMoney } from './money';

/** A card that opens to show more: a header row (title, line under it, amount) and its body. */
export function Collapsible({
  title,
  summary,
  amount,
  big = false,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  amount: ReactNode;
  big?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center gap-3 px-5 py-3.5 text-start lg:px-[26px]"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{title}</span>
          {summary && <span className="truncate text-[13px] text-text-2">{summary}</span>}
        </span>
        <b className={`whitespace-nowrap tabular-nums ${big ? 'text-[17px]' : ''}`}>{amount}</b>
        <Icon
          name="chevronDown"
          size={18}
          className={`flex-none text-text-2 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </Card>
  );
}

/** A row of a card: a label and its value, with the card's hairline above. */
export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-h-12 items-center justify-between gap-3 px-5 py-3 text-sm shadow-[inset_0_1px_0_var(--hair)] lg:px-[26px] ${className}`}
    >
      {children}
    </div>
  );
}

/** The invoice's items, one per row, each with its discount and old price. */
export function ItemRows({ payment }: { payment: PaymentData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const money = useMoney(payment.currency);
  const noteOf = useItemNote();

  return (
    <ol className="m-0 list-none p-0">
      {payment.items.map((item, index) => {
        const price = itemPrice(item);
        const note = noteOf(item);
        return (
          <li key={`${String(index)}-${item.label}`}>
            <Row className="items-start">
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px]">{item.label}</span>
                {note && <span className="text-[13px] text-text-2">{note}</span>}
                {item.tax > 0 && (
                  <span className="text-[13px] text-text-2">{t('payment.buy.taxed')}</span>
                )}
              </span>
              <span className="flex flex-col items-end text-end">
                <b className="whitespace-nowrap tabular-nums">{money(price)}</b>
                {price < item.price && (
                  <span className="text-xs whitespace-nowrap">
                    <span className="font-semibold text-primary-text">
                      {t('payment.buy.percentOff', {
                        percent: f.number(Math.round((1 - price / item.price) * 100)),
                      })}
                    </span>{' '}
                    <s className="text-text-2 tabular-nums">{f.number(item.price)}</s>
                  </span>
                )}
              </span>
            </Row>
          </li>
        );
      })}
    </ol>
  );
}

/** A page's main state: an icon in a circle, its title and what it means. */
export function Hero({
  icon,
  tone,
  title,
  children,
}: {
  icon: IconName;
  tone: 'good' | 'warn' | 'danger' | 'info';
  title: string;
  children?: ReactNode;
}) {
  const TONES = {
    good: 'bg-good-tint text-good',
    warn: 'bg-warn-tint text-warn',
    danger: 'bg-danger-tint text-danger',
    info: 'bg-info-tint text-info',
  };
  return (
    <Card className="flex flex-col items-center gap-3 p-5 text-center lg:p-[26px]">
      <span
        aria-hidden="true"
        className={`flex size-14 items-center justify-center rounded-full ${TONES[tone]}`}
      >
        <Icon name={icon} size={26} />
      </span>
      <h1 className="m-0 text-xl font-bold">{title}</h1>
      {children}
    </Card>
  );
}

/** Label and value pairs under a hairline (method, date, bank reference). */
export function Facts({ facts }: { facts: [string, ReactNode][] }) {
  return (
    <dl className="m-0 flex flex-col">
      {facts.map(([label, value]) => (
        <Row key={label}>
          <dt className="text-text-2">{label}</dt>
          <dd className="m-0 text-end font-medium">{value}</dd>
        </Row>
      ))}
    </dl>
  );
}

/** The bottom action: pinned above the tabs on a phone, in the flow on a wide screen. */
export function Dock({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(var(--panel-bottom,0px)+0.75rem)] z-20 flex flex-col gap-2 lg:static">
      {children}
    </div>
  );
}
