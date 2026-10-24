import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { boardQuery, STALE_DAYS, type BoardCard, type BoardData } from './api';
import { ScoreChip } from './components/LeadChips';
import { useSalesFormat } from './format';
import { customerPath, salesPath } from './paths';

const DAY = 86_400_000;

/** Deals by stage, oldest-in-stage flagged, with lost reasons below. Canvas "تابلوی فروش". */
export default function BoardPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const { data } = useSuspenseQuery(boardQuery);

  return (
    <PageStack>
      <PageHeader
        title={t('board.title')}
        subtitle={t('board.subtitle', {
          value: s.millions(data.open_value),
          days: f.number(STALE_DAYS),
        })}
        actions={
          <Link to={salesPath('leads')} className={buttonClass('outline')}>
            {t('board.listView')}
          </Link>
        }
      />
      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        <div className="grid min-w-[1320px] grid-cols-6 items-start gap-4">
          {data.columns.map((column) => (
            <section
              key={column.stage}
              aria-labelledby={`col-${column.stage}`}
              className={`flex flex-col gap-3 rounded-card-sm p-3.5 ${
                column.stage === 'won'
                  ? 'bg-good-tint'
                  : column.stage === 'draft'
                    ? 'bg-tint'
                    : 'bg-track'
              }`}
            >
              <div className="flex flex-col gap-1 px-1 pt-1 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`col-${column.stage}`} className="m-0 text-[15px] font-bold">
                    {t(`stage.${column.stage}`)}
                  </h2>
                  <span className="text-sm text-text-2 tabular-nums">{f.number(column.count)}</span>
                </div>
                <span className="text-[13px] text-text-2">
                  {column.value === null ? t('board.noValue') : s.millions(column.value)}
                </span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {column.cards.map((card) => (
                  <li key={card.lead}>
                    <DealCard card={card} />
                  </li>
                ))}
              </ul>
              {column.count > column.cards.length && (
                <Link
                  to={salesPath(`leads?stage=${column.stage}`)}
                  className="px-1 text-sm text-primary-text"
                >
                  {t('board.more', { n: f.number(column.count - column.cards.length) })}
                </Link>
              )}
            </section>
          ))}
        </div>
      </div>
      <LostCard lost={data.lost} />
    </PageStack>
  );
}

function DealCard({ card }: { card: BoardCard }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  // Read once: the board doesn't need to re-render by the minute.
  const [now] = useState(() => Date.now());
  const stale = now - new Date(card.stage_since).getTime() > STALE_DAYS * DAY;
  const next: { text: string; urgent: boolean } | null = !card.next
    ? null
    : card.next.kind === 'follow_up'
      ? s.due(card.next.at, 'contacted', true)
      : { text: t(`board.next.${card.next.kind}`), urgent: card.next.kind === 'call_now' };

  return (
    <Link
      to={customerPath(card.customer)}
      className={`flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 text-text hover:shadow-[0_0_0_1.5px_var(--primary)] ${
        stale ? 'shadow-[0_0_0_2px_var(--hero-current)]' : 'shadow-panel'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">{card.name}</span>
        <ScoreChip score={card.score} />
      </span>
      <span className="text-[13px] leading-6 text-text-2">{card.summary}</span>
      <span className="flex items-center justify-between gap-2 text-[13px]">
        <span className="font-semibold tabular-nums">
          {card.paid !== null
            ? t('board.paid', { amount: s.millions(card.paid) })
            : card.amount !== null
              ? s.millions(card.amount)
              : t('due.none')}
        </span>
        <span className={stale ? 'font-semibold text-urgent' : 'text-text-2'}>
          {s.age(card.stage_since)}
          {stale && (
            <span className="sr-only"> · {t('board.stale', { n: f.number(STALE_DAYS) })}</span>
          )}
        </span>
      </span>
      {next && (
        <span
          className={`flex items-center gap-1.5 pt-2 text-[13px] shadow-[inset_0_1px_0_var(--hair)] ${next.urgent ? 'font-semibold text-urgent' : 'text-neutral'}`}
        >
          <Icon name="clock" size={14} />
          {next.text}
        </span>
      )}
    </Link>
  );
}

function LostCard({ lost }: { lost: BoardData['lost'] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const total = lost.reasons.reduce((sum, item) => sum + item.count, 0);
  const shades = ['bg-primary', 'bg-hero-accent', 'bg-hero-current', 'bg-line-3'];
  const items = lost.reasons.map((item) =>
    t('board.lost.item', { reason: t(`lost.${item.reason}`), n: f.number(item.count) }),
  );
  return (
    <Card aria-labelledby="lost-title" className="flex flex-col gap-4 p-5 lg:px-8 lg:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="lost-title" className="m-0 font-display text-lg font-bold">
          {t('board.lost.title', { n: f.number(lost.total) })}
        </h2>
        <span className="text-sm text-text-2">{t('board.lost.note')}</span>
      </div>
      {total > 0 && (
        <div
          role="img"
          aria-label={f.list(items)}
          className="flex h-3 gap-0.5 overflow-hidden rounded-md"
        >
          {lost.reasons.map((item, index) => (
            <span
              key={item.reason}
              className={shades[index % shades.length]}
              style={{ flex: item.count }}
            />
          ))}
        </div>
      )}
      <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm text-neutral">
        {lost.reasons.map((item, index) => (
          <li key={item.reason} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`size-2.5 rounded-[3px] ${shades[index % shades.length] ?? ''}`}
            />
            {items[index]}
          </li>
        ))}
      </ul>
    </Card>
  );
}
