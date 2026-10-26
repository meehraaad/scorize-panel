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

export function DealCard({ card }: { card: BoardCard }) {
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
      draggable={false}
      className={`flex flex-col gap-2.5 rounded-[20px] bg-surface p-4 text-text hover:shadow-[0_0_0_1.5px_var(--primary)] ${
        stale ? 'shadow-[0_0_0_2px_var(--hero-current)]' : 'shadow-panel'
      }`}
    >
      <span className="flex min-h-8 items-center pe-10 text-[15px] font-semibold">{card.name}</span>
      <span>
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
