import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { SectionHeading } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Upsell } from '../api';
import { customerPath, salesPath } from '../paths';

type Item =
  | Exclude<Upsell, { kind: 'admitted' }>
  | { kind: 'admitted'; customer: number; name: string; universities: string[] };

/** Django sends one "admitted" row per admission: show each customer once, with all their offers. */
function mergeAdmissions(items: Upsell[]): Item[] {
  const merged: Item[] = [];
  const admitted = new Map<number, string[]>();
  for (const item of items) {
    if (item.kind !== 'admitted') {
      merged.push(item);
      continue;
    }
    const universities = admitted.get(item.customer);
    if (universities) {
      if (!universities.includes(item.university)) universities.push(item.university);
      continue;
    }
    const entry = {
      kind: item.kind,
      customer: item.customer,
      name: item.name,
      universities: [item.university],
    };
    admitted.set(item.customer, entry.universities);
    merged.push(entry);
  }
  return merged;
}

const TONE: Record<Upsell['kind'], ChipTone> = {
  admitted: 'good',
  ending: 'warn',
  no_contract: 'info',
};

/** Customers ready for their next purchase (canvas "فرصت‌های فروش مکمل"). */
export function UpsellSection({ items }: { items: Upsell[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();

  const content = (item: Item) => {
    switch (item.kind) {
      case 'admitted':
        return {
          title: t('today.upsell.admitted.title', {
            name: item.name,
            university: f.list(item.universities),
          }),
          meta: t('today.upsell.admitted.meta'),
          to: customerPath(item.customer),
        };
      case 'ending':
        return {
          title: t('today.upsell.ending.title', { name: item.name, days: f.number(item.days) }),
          meta: t('today.upsell.ending.meta', { n: f.number(item.admissions) }),
          to: customerPath(item.customer),
        };
      case 'no_contract':
        return {
          title: t('today.upsell.no_contract.title', { n: f.number(item.customers.length) }),
          meta: f.list(item.customers.map((customer) => customer.name)),
          to: salesPath('leads?stage=consulted'),
        };
    }
  };

  return (
    <section aria-labelledby="upsell-title" className="flex flex-col gap-4">
      <SectionHeading
        id="upsell-title"
        title={t('today.upsell.title')}
        subtitle={t('today.upsell.subtitle')}
      />
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
        {mergeAdmissions(items).map((item, index) => {
          const { title, meta, to } = content(item);
          return (
            <li key={index} className="flex">
              <Card className="flex flex-1 flex-col items-start gap-3 p-5 lg:p-6">
                <Chip tone={TONE[item.kind]} small>
                  {t(`today.upsell.${item.kind}.tag`)}
                </Chip>
                <span className="text-base leading-7 font-semibold">{title}</span>
                <span className="flex-1 text-sm leading-6 text-text-2">{meta}</span>
                <Link to={to} className={buttonClass('outline', 'h-11 px-4 text-sm')}>
                  {t(`today.upsell.${item.kind}.action`)}
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
