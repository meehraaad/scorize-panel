import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { offerQuery, type OfferTemplate } from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';

/** The standard contract in the URL (`?template=standard`), as the offer page reads it. */
const STANDARD = 'standard';
const valueOf = (id: number | null) => (id === null ? STANDARD : String(id));

/**
 * "New contract" on the customer page (S71, canvas "قرارداد تازه · انتخاب قرارداد"): the kinds of
 * contract the sales manager keeps active, each a card with what it offers, from what price and
 * how much text, then the offer built step by step. An open draft is offered first; starting
 * another kind replaces it once saved (one open offer per customer).
 */
export function ContractChooser({
  customer,
  name,
  onClose,
  onPick,
}: {
  customer: number;
  name: string;
  onClose: () => void;
  /** On the offer page: switch its kind there. Elsewhere: open the offer page on that kind. */
  onPick?: (template: number | null) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(offerQuery(customer));
  const { templates } = data.options;
  const open = data.status;
  const [picked, setPicked] = useState(valueOf(open?.template ?? templates[0]?.id ?? null));
  const kind = templates.find((row) => valueOf(row.id) === picked) ?? templates[0];
  const replaces = open !== null && valueOf(open.template) !== picked;

  const go = (template: number | null, keep = false) => {
    onClose();
    if (onPick) onPick(template);
    else
      void navigate(
        keep
          ? `${customerPath(customer)}/offer`
          : `${customerPath(customer)}/offer?template=${valueOf(template)}`,
      );
  };

  /** From the cheapest service it offers; free when it costs nothing. */
  const price = (row: OfferTemplate) => {
    const paid = row.features.map((feature) => feature.price).filter((amount) => amount > 0);
    return paid.length
      ? t('chooser.from', { price: s.exact(Math.min(...paid), row.currency ?? 'IRT') })
      : t('chooser.free');
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('chooser.title')}
      subtitle={t('chooser.subtitle', { name })}
      closeLabel={t('close')}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('chooser.cancel')}
          </Button>
          {kind && (
            <Button onClick={() => go(kind.id)}>{t('chooser.go', { name: kind.name })}</Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {open && (
          <Notice tone="warn">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {t('chooser.open', {
                  name: open.name,
                  state: t(`contractCard.state.${open.state}`),
                  when: f.timeAgo(open.updated_at),
                })}
              </span>
              <Button variant="outline" onClick={() => go(open.template, true)}>
                {t('chooser.continue')}
              </Button>
            </span>
          </Notice>
        )}
        <ChoiceGroup
          legend={t('chooser.kinds')}
          hideLegend
          look="cards"
          value={picked}
          onChange={setPicked}
          options={templates.map((row) => ({
            value: valueOf(row.id),
            label: row.name,
            hint: row.description || undefined,
            extra: (
              <span className="mt-1.5 flex flex-col gap-1.5">
                <span className="flex flex-wrap gap-1.5">
                  {row.features.map((feature) => (
                    <span
                      key={feature.key}
                      className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-text-2"
                    >
                      {t(`apply.feature.${feature.key}`)}
                    </span>
                  ))}
                </span>
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-[15px] font-bold tabular-nums">{price(row)}</span>
                  <span className="text-xs text-text-2">
                    {t('chooser.size', {
                      articles: f.number(row.articles),
                      variables: f.number(row.variables),
                    })}
                  </span>
                </span>
              </span>
            ),
          }))}
          hint={replaces ? t('chooser.replaces', { name: open.name }) : t('chooser.hint')}
        />
      </div>
    </Dialog>
  );
}
