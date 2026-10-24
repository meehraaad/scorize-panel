import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { purchasesQuery, type ProductCategory, type Purchase } from './api';
import { useCustomerId } from './useCustomerId';
import { useSalesFormat } from './format';
import { customerPath } from './paths';

/** Sections of the tab: packages and events are one group, as on the old crm page. */
const GROUPS = ['consultation', 'writing', 'product'] as const;
type Group = (typeof GROUPS)[number];
const groupOf = (category: ProductCategory): Group =>
  category === 'consultation' || category === 'writing' ? category : 'product';
const SELL_CATEGORY: Record<Group, ProductCategory> = {
  consultation: 'consultation',
  writing: 'writing',
  product: 'package',
};

type Status = 'logged' | 'held' | 'upcoming' | 'paid' | 'pending' | 'failed';
const TONE: Record<Status, ChipTone> = {
  logged: 'good',
  held: 'warn',
  upcoming: 'info',
  paid: 'good',
  pending: 'neutral',
  failed: 'danger',
};

const statusOf = (item: Purchase, now: number): Status => {
  if (item.status !== 'paid' || !item.session) return item.status;
  if (new Date(item.session.starts_at).getTime() > now) return 'upcoming';
  return item.session.logged ? 'logged' : 'held';
};

/** Purchases and consultations of the customer, by kind. Canvas "خریدها و مشاوره‌ها". */
export default function CustomerPurchasesPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const id = useCustomerId();
  const { data } = useSuspenseQuery(purchasesQuery(id));
  const [, setParams] = useSearchParams();
  // Read once per visit: whether a session is past doesn't change while the tab is open.
  const [now] = useState(() => Date.now());

  const sell = (group: Group) =>
    setParams(
      (current) => {
        current.set('sell', SELL_CATEGORY[group]);
        return current;
      },
      { replace: true },
    );

  return (
    <>
      <StatGrid
        label={t('purchases.stats')}
        stats={[
          { label: t('purchases.total'), value: s.millions(data.total) },
          {
            label: t('purchases.sessions'),
            value: t('purchases.sessionsValue', {
              held: f.number(data.sessions.held),
              upcoming: f.number(data.sessions.upcoming),
            }),
          },
          {
            label: t('purchases.failed'),
            value: data.failed ? f.number(data.failed.count) : f.number(0),
            tone: data.failed ? 'urgent' : 'default',
            ...(data.failed ? { note: f.timeAgo(data.failed.last_at) } : {}),
          },
        ]}
      />
      {GROUPS.map((group) => {
        const items = data.items.filter((item) => groupOf(item.category) === group);
        return (
          <SectionCard
            key={group}
            id={`purchases-${group}`}
            title={t(`purchases.group.${group}`)}
            end={
              <Button variant="outline" className="h-11 px-4 text-sm" onClick={() => sell(group)}>
                {t(`purchases.add.${group}`)}
              </Button>
            }
          >
            {items.length === 0 ? (
              <EmptyState>{t('purchases.empty')}</EmptyState>
            ) : (
              <ul className="m-0 list-none p-0">
                {items.map((item) => {
                  const status = statusOf(item, now);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
                    >
                      <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                        <span className="text-[15px] font-semibold">{item.title}</span>
                        <span className="text-[13px] leading-6 text-text-2">{item.detail}</span>
                      </span>
                      <span className="w-28 flex-none text-sm font-semibold tabular-nums">
                        {item.amount === 0 ? t('purchases.free') : s.millions(item.amount)}
                      </span>
                      <Chip tone={TONE[status]} small>
                        {t(`purchases.status.${status}`)}
                      </Chip>
                      {status === 'held' && item.session && (
                        <Link
                          to={customerPath(id, 'meeting', item.session.reservation)}
                          className={buttonClass('primary', 'h-11 px-4 text-sm')}
                        >
                          {t('purchases.logSession')}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        );
      })}
    </>
  );
}
