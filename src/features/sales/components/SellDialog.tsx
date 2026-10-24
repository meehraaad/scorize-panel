import { useQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  productsQuery,
  useQuote,
  useSell,
  type CustomerData,
  type PaymentMethod,
  type ProductCategory,
  type SaleQuote,
} from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';

const CATEGORIES = ['consultation', 'writing', 'package', 'event'] as const;
const METHODS = ['online', 'receipt'] as const satisfies readonly PaymentMethod[];

/**
 * Sell a product from the customer page, in the customer's name: no more opening the site in a
 * popup and filling the cart for them (static/finance/sell.js). Canvas "فروش محصول".
 */
export function SellDialog({
  customer,
  category,
  onClose,
}: {
  customer: CustomerData;
  /** The tab to open on; null = closed. */
  category: ProductCategory | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const navigate = useNavigate();
  const { data } = useQuery({ ...productsQuery, enabled: category !== null });
  const quote = useQuote(customer.id);
  const sell = useSell(customer.id);
  const [tab, setTab] = useState<ProductCategory>(category ?? 'consultation');
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [slot, setSlot] = useState('');
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<SaleQuote | null>(null);
  const [credit, setCredit] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('online');
  const [checked, setChecked] = useState(false);

  const products = data?.products ?? [];
  const chosen = products.filter((product) => picked.has(product.id));
  const subtotal = chosen.reduce((sum, product) => sum + product.price, 0);
  const consultation = chosen.find((product) => product.slots.length > 0);
  const total = Math.max(
    0,
    (applied?.total ?? subtotal) - (credit ? Math.min(customer.credit, subtotal) : 0),
  );

  const toggle = (id: number) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    // The code was checked against the old cart.
    setApplied(null);
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (chosen.length === 0 || (consultation && !slot)) return;
    sell.mutate(
      {
        products: chosen.map((product) => product.id),
        ...(consultation && slot ? { slot: Number(slot) } : {}),
        ...(applied && !applied.discount_error && code.trim()
          ? { discount_code: code.trim() }
          : {}),
        use_credit: credit,
        method,
      },
      {
        onSuccess: ({ payment }) => {
          onClose();
          void navigate(`${customerPath(customer.id)}/payments?payment=${String(payment)}`);
        },
      },
    );
  };

  return (
    <Dialog
      open={category !== null}
      onClose={onClose}
      title={t('sell.title', { name: customer.name })}
      subtitle={t('sell.subtitle')}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="sell-form" disabled={sell.isPending}>
            {method === 'online' ? t('sell.submitOnline') : t('sell.submitReceipt')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="sell-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <FilterTabs
          label={t('sell.category')}
          value={tab}
          onChange={setTab}
          options={CATEGORIES.map((value) => ({ value, label: t(`sell.categoryOption.${value}`) }))}
        />
        {!data ? (
          <SkeletonRows rows={3} />
        ) : (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">{t(`sell.categoryOption.${tab}`)}</legend>
            {products
              .filter((product) => product.category === tab)
              .map((product) => (
                <label
                  key={product.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-tint has-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-focus"
                >
                  <input
                    type="checkbox"
                    checked={picked.has(product.id)}
                    onChange={() => toggle(product.id)}
                    className="size-[18px] flex-none accent-primary"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{product.title}</span>
                    <span className="text-[13px] text-text-2">{product.detail}</span>
                  </span>
                  <span className="flex-none text-sm font-bold tabular-nums">
                    {product.price === 0 ? t('purchases.free') : s.toman(product.price)}
                  </span>
                </label>
              ))}
          </fieldset>
        )}
        {checked && chosen.length === 0 && <Notice tone="error">{t('sell.nothingPicked')}</Notice>}

        {consultation && (
          <SelectField
            label={t('sell.slot', { product: consultation.title })}
            value={slot}
            onChange={setSlot}
            error={checked && !slot ? t('sell.slotRequired') : undefined}
            options={[
              { value: '', label: t('customer.logDialog.choose') },
              ...consultation.slots.map((item) => ({
                value: String(item.id),
                label: t('sell.slotOption', {
                  when: `${f.weekday(item.starts_at)} · ${f.time(item.starts_at)}`,
                  consultant: item.consultant,
                }),
              })),
            ]}
          />
        )}

        <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label={t('sell.code')}
                dir="ltr"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setApplied(null);
                }}
                error={
                  applied?.discount_error
                    ? t(`sell.codeError.${applied.discount_error}`)
                    : undefined
                }
              />
            </div>
            <Button
              variant="outline"
              className="mb-0.5"
              disabled={!code.trim() || chosen.length === 0 || quote.isPending}
              onClick={() =>
                quote.mutate(
                  {
                    products: chosen.map((product) => product.id),
                    discount_code: code.trim(),
                    use_credit: false,
                  },
                  { onSuccess: setApplied },
                )
              }
            >
              {t('sell.apply')}
            </Button>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm has-disabled:text-text-2">
            <input
              type="checkbox"
              checked={credit}
              disabled={customer.credit === 0}
              onChange={(event) => setCredit(event.target.checked)}
              className="size-[18px] accent-primary"
            />
            {t('sell.credit', { amount: s.toman(customer.credit) })}
          </label>
          {applied && !applied.discount_error && applied.discount > 0 && (
            <span className="flex items-center gap-2 text-sm text-good">
              <Icon name="check" size={16} />
              {t('sell.discount', { amount: s.toman(applied.discount) })}
            </span>
          )}
          <div className="flex items-baseline justify-between gap-3 pt-2 text-[15px] font-bold shadow-[inset_0_1px_0_var(--hair)]">
            <span>{t('sell.total')}</span>
            <span className="tabular-nums">{chosen.length ? s.toman(total) : t('due.none')}</span>
          </div>
        </div>

        <ChoiceGroup
          legend={t('sell.method')}
          look="tiles"
          value={method}
          onChange={setMethod}
          options={METHODS.map((value) => ({
            value,
            label: t(`sell.methodOption.${value}`),
            hint: t(`sell.methodHint.${value}`),
          }))}
        />
        {sell.isError && <Notice tone="error">{t('error')}</Notice>}
      </form>
    </Dialog>
  );
}
