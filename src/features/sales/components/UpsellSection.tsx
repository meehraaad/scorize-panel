import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Card } from '@/components/ui/Card';
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

const LOOK: Record<Upsell['kind'], { tone: ChipTone; icon: IconName; tile: string }> = {
  admitted: { tone: 'good', icon: 'graduation', tile: 'bg-good-tint text-good' },
  ending: { tone: 'warn', icon: 'clock', tile: 'bg-warn-tint text-warn' },
  no_contract: { tone: 'info', icon: 'calendar', tile: 'bg-info-tint text-info' },
};

/** A card's width and the gap after it: how far the arrows scroll. */
const CARD_STEP = 272 + 16;

/** At most this many people of a group show by name; the rest are counted. */
const PEOPLE_SHOWN = 3;

/**
 * Customers ready for their next purchase (canvas "فرصت‌های فروش مکمل"): a row of cards that
 * scrolls sideways (arrows beside the title), one per chance,
 * with why it is one and the step that sells it (an offer, or the list of people to call).
 */
export function UpsellSection({ items }: { items: Upsell[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const merged = mergeAdmissions(items);
  const row = useRef<HTMLUListElement>(null);
  // Which ends the row is scrolled to: the arrows hide when every card fits.
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    // In RTL scrollLeft runs from 0 to negative: its size is the distance from the start.
    const from = Math.abs(el.scrollLeft);
    setEdges({ start: from <= 1, end: from + el.clientWidth >= el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, items]);
  /** One card further along (1) or back (-1), in reading direction. */
  const scroll = (step: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: step * (rtl ? -1 : 1) * CARD_STEP, behavior: 'smooth' });
  };
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
    <section aria-labelledby="upsell-title" className="flex min-w-0 flex-col gap-4">
      <SectionHeading
        id="upsell-title"
        title={t('today.upsell.title')}
        subtitle={t('today.upsell.subtitle', { n: f.number(people) })}
        end={
          (!edges.start || !edges.end) && (
            <span className="flex gap-1">
              <IconButton
                icon="chevronStart"
                aria-label={t('today.upsell.previous')}
                disabled={edges.start}
                onClick={() => scroll(-1)}
                className="shadow-[inset_0_0_0_1px_var(--line-2)]"
              />
              <IconButton
                icon="chevronEnd"
                aria-label={t('today.upsell.next')}
                disabled={edges.end}
                onClick={() => scroll(1)}
                className="shadow-[inset_0_0_0_1px_var(--line-2)]"
              />
            </span>
          )
        }
      />
      <ul
        ref={row}
        onScroll={measure}
        className="m-0 -mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] list-none gap-4 overflow-x-auto px-4 py-1 lg:mx-0 lg:scroll-px-0.5 lg:px-0.5"
      >
        {merged.map((item, index) => {
          const { title, meta, to } = content(item);
          const look = LOOK[item.kind];
          return (
            <li key={index} className="flex w-[272px] flex-none snap-start">
              <Card className="flex flex-1 flex-col items-start gap-3 p-5 lg:p-6">
                <span className="flex w-full items-center justify-between gap-2">
                  <Chip tone={look.tone} small>
                    {t(`today.upsell.${item.kind}.tag`)}
                  </Chip>
                  <span
                    aria-hidden="true"
                    className={`flex size-10 flex-none items-center justify-center rounded-icon ${look.tile}`}
                  >
                    <Icon name={look.icon} size={18} />
                  </span>
                </span>
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
                <Link to={to} className={buttonClass('outline', 'mt-auto h-11 px-4 text-sm')}>
                  {t(`today.upsell.${item.kind}.action`)}
                  <Icon name="chevronEnd" size={16} />
                </Link>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
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
            className="inline-flex h-9 items-center rounded-full bg-canvas px-3 text-[13px] text-text hover:shadow-[inset_0_0_0_1px_var(--line-2)]"
          >
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
