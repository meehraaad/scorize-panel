import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { useFormat } from '@/lib/i18n/useFormat';
import { boardQuery, STALE_DAYS, type BoardData } from './api';
import { SalesBoard } from './components/SalesBoard';
import { useSalesFormat } from './format';
import { salesPath } from './paths';

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
      <SalesBoard data={data} />
      <LostCard lost={data.lost} />
    </PageStack>
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
