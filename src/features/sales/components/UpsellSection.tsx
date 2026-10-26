import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Badge, SectionCard } from '@/components/ui/SectionCard';
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

const LOOK: Record<Upsell['kind'], { tone: ChipTone; icon: IconName; tile: string }> = {
  admitted: { tone: 'good', icon: 'graduation', tile: 'bg-good-tint text-good' },
  ending: { tone: 'warn', icon: 'clock', tile: 'bg-warn-tint text-warn' },
  no_contract: { tone: 'info', icon: 'calendar', tile: 'bg-info-tint text-info' },
};

/** At most this many people of a group show by name; the rest are counted. */
const PEOPLE_SHOWN = 4;

/**
 * Customers ready for their next purchase (canvas "فرصت‌های فروش مکمل"): one row per chance,
 * with why it is one and the step that sells it (an offer, or the list of people to call).
 */
export function UpsellSection({ items }: { items: Upsell[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const merged = mergeAdmissions(items);
  const people = merged.reduce(
    (sum, item) => sum + (item.kind === 'no_contract' ? item.customers.length : 1),
    0,
  );

  const content = (item: Item) => {
    switch (item.kind) {
      case 'admitted':
        return {
          title: t('today.upsell.admitted.title', {
            name: item.name,
            university: f.list(item.universities),
          }),
          meta: t('today.upsell.admitted.meta'),
          to: `${customerPath(item.customer)}/offer`,
        };
      case 'ending':
        return {
          title: t('today.upsell.ending.title', { name: item.name, days: f.number(item.days) }),
          meta: t('today.upsell.ending.meta', { n: f.number(item.admissions) }),
          to: `${customerPath(item.customer)}/offer`,
        };
      case 'no_contract':
        return {
          title: t('today.upsell.no_contract.title', { n: f.number(item.customers.length) }),
          meta: t('today.upsell.no_contract.meta'),
          to: salesPath('leads?stage=consulted'),
        };
    }
  };

  return (
    <SectionCard
      id="upsell-title"
      title={t('today.upsell.title')}
      badge={<Badge>{f.number(merged.length)}</Badge>}
      subtitle={t('today.upsell.subtitle', { n: f.number(people) })}
    >
      <ul className="m-0 list-none p-0">
        {merged.map((item, index) => {
          const { title, meta, to } = content(item);
          const look = LOOK[item.kind];
          return (
            <li
              key={index}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span
                aria-hidden="true"
                className={`flex size-11 flex-none items-center justify-center rounded-icon ${look.tile}`}
              >
                <Icon name={look.icon} size={20} />
              </span>
              <div className="flex min-w-0 flex-[1_1_280px] flex-col items-start gap-1.5">
                <Chip tone={look.tone} small>
                  {t(`today.upsell.${item.kind}.tag`)}
                </Chip>
                {item.kind === 'no_contract' ? (
                  <span className="text-base leading-7 font-semibold">{title}</span>
                ) : (
                  <Link
                    to={customerPath(item.customer)}
                    className="text-base leading-7 font-semibold text-text hover:underline"
                  >
                    {title}
                  </Link>
                )}
                <span className="text-sm leading-6 text-text-2">{meta}</span>
                {item.kind === 'no_contract' && <People customers={item.customers} />}
              </div>
              <Link to={to} className={buttonClass('outline', 'h-11 px-4 text-sm')}>
                {t(`today.upsell.${item.kind}.action`)}
                <Icon name="chevronEnd" size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

/** The people of a group chance, each a link to their page. */
function People({ customers }: { customers: { id: number; name: string }[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const rest = customers.length - PEOPLE_SHOWN;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {customers.slice(0, PEOPLE_SHOWN).map((customer) => (
        <li key={customer.id}>
          <Link
            to={customerPath(customer.id)}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-canvas ps-1 pe-3 text-sm text-text hover:shadow-[inset_0_0_0_1px_var(--line-2)]"
          >
            <Avatar name={customer.name} size="sm" />
            {customer.name}
          </Link>
        </li>
      ))}
      {rest > 0 && (
        <li className="inline-flex h-9 items-center px-2 text-sm text-text-2">
          {t('today.upsell.more', { n: f.number(rest) })}
        </li>
      )}
    </ul>
  );
}
