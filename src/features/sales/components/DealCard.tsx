import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { STALE_DAYS, type BoardCard } from '../api';
import { useSalesFormat } from '../format';
import { customerPath } from '../paths';
import { ScoreChip } from './LeadChips';

const DAY = 86_400_000;

export function DealCard({
  card,
  staleDays = STALE_DAYS,
}: {
  card: BoardCard;
  /** The column's limit (S48), or the default. */
  staleDays?: number;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const [now] = useState(() => Date.now());
  const stale = now - new Date(card.stage_since).getTime() > staleDays * DAY;
  const next = !card.next
    ? null
    : card.next.kind === 'follow_up'
      ? s.due(card.next.at, 'contacted', true)
      : { text: t(`board.next.${card.next.kind}`), urgent: card.next.kind === 'call_now' };

  return (
    <Link
      to={customerPath(card.customer)}
      draggable={false}
      className="group/deal flex flex-col gap-3 rounded-xl border border-hair bg-surface p-3.5 text-text shadow-board-card hover:border-line-3 motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150"
    >
      <span className="flex min-h-6 items-center gap-2 pe-9">
        <ScoreChip score={card.score} />
        {card.seller && (
          <span className="truncate text-[11px] text-text-2">
            {t('board.sellerOf', { name: card.seller })}
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1">
        <span className="line-clamp-2 text-[15px] leading-6 font-semibold">{card.name}</span>
        <span className="line-clamp-2 text-[13px] leading-6 text-text-2">{card.summary}</span>
      </span>
      {card.paid !== null || card.amount !== null ? (
        <span className="text-[15px] font-semibold tabular-nums">
          {card.paid !== null
            ? t('board.paid', { amount: s.millions(card.paid) })
            : s.millions(card.amount ?? 0)}
        </span>
      ) : null}
      <span className="flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-2.5 text-[11px] leading-5">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${stale ? 'bg-warn-tint font-medium text-warn' : 'text-text-2'}`}
        >
          <Icon name="clock" size={12} />
          {s.age(card.stage_since)}
          {stale && (
            <span className="sr-only"> · {t('board.stale', { n: f.number(staleDays) })}</span>
          )}
        </span>
        {next && (
          <span
            className={`inline-flex min-w-0 items-center gap-1 ${next.urgent ? 'font-medium text-urgent' : 'text-text-2'}`}
          >
            <Icon
              name={
                card.next?.kind === 'call_now'
                  ? 'phone'
                  : card.next?.kind === 'manager'
                    ? 'lock'
                    : 'calendar'
              }
              size={12}
            />
            <span>{next.text}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
