import { ContactLogButton } from '@/components/sales/ContactLogButton';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { ChoiceGroup } from '@/components/ui/Choices';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatGrid } from '@/components/ui/StatGrid';
import { useFormat } from '@/lib/i18n/useFormat';
import { purchasesQuery, type ProductCategory, type Purchase } from './api';
import { useCustomerId } from './useCustomerId';
import { useSalesFormat } from './format';

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

const LOOK: Record<Group, { icon: IconName; tone: string }> = {
  consultation: { icon: 'user', tone: 'bg-info-tint text-info' },
  writing: { icon: 'pen', tone: 'bg-tint text-primary-text' },
  product: { icon: 'card', tone: 'bg-good-tint text-good' },
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

/** Purchases and consultations of the customer in one list, filtered by kind. Canvas board Money. */
export default function CustomerPurchasesPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const id = useCustomerId();
  const { data } = useSuspenseQuery(purchasesQuery(id));
  const [, setParams] = useSearchParams();
  // Read once per visit: whether a session is past doesn't change while the tab is open.
  const [now] = useState(() => Date.now());

  const [group, setGroup] = useState<Group | 'all'>('all');
  const items = data.items.filter((item) => group === 'all' || groupOf(item.category) === group);

  const sell = () =>
    setParams(
      (current) => {
        current.set('sell', SELL_CATEGORY[group === 'all' ? 'consultation' : group]);
        return current;
      },
      { replace: true },
    );

  return (
    <>
      <StatGrid
        compact
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
      <SectionCard
        id="purchases"
        title={t('purchases.title')}
        end={
          <span className="flex flex-wrap items-center gap-2">
            <ChoiceGroup
              legend={t('purchases.filter')}
              hideLegend
              look="segmented"
              value={group}
              onChange={setGroup}
              options={(['all', ...GROUPS] as const).map((value) => ({
                value,
                label: t(`purchases.group.${value}`),
              }))}
            />
            <button
              type="button"
              onClick={sell}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-tint px-4 text-[13px] font-semibold text-primary-text"
            >
              <Icon name="plus" size={15} />
              {t(`purchases.add.${group === 'all' ? 'consultation' : group}`)}
            </button>
          </span>
        }
      >
        {items.length === 0 ? (
          <EmptyState>{t('purchases.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((item) => {
              const status = statusOf(item, now);
              const look = LOOK[groupOf(item.category)];
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-[38px] flex-none items-center justify-center rounded-xl ${
                      status === 'failed' ? 'bg-danger-tint text-danger' : look.tone
                    }`}
                  >
                    <Icon name={look.icon} size={17} />
                  </span>
                  <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                    <span className="text-[15px] font-semibold">{item.title}</span>
                    <span className="text-[13px] leading-6 text-text-2">{item.detail}</span>
                  </span>
                  <span
                    className={`flex-none text-sm font-bold tabular-nums ${status === 'failed' ? 'text-text-2 line-through' : ''}`}
                  >
                    {item.amount === 0 ? t('purchases.free') : s.millions(item.amount)}
                  </span>
                  <Chip tone={TONE[status]} small>
                    {t(`purchases.status.${status}`)}
                  </Chip>
                  {status === 'held' && item.session && (
                    <ContactLogButton
                      customer={id}
                      name={''}
                      start={{
                        channel: 'meeting',
                        reservation: item.session.reservation,
                        session: { title: item.title, starts_at: item.session.starts_at },
                      }}
                      className={buttonClass('primary', 'h-11 px-4 text-sm')}
                    >
                      {t('purchases.logSession')}
                    </ContactLogButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
