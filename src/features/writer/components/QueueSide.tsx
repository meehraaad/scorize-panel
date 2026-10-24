import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { DateTile } from '@/components/ui/DateTile';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { safeHref } from '@/lib/url';
import type { QueueData } from '../api';
import { orderPath } from '../paths';
import { useOrderText } from './useOrderText';

/** Versions due this week, by day. */
export function WeekCard({ week }: { week: QueueData['week'] }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  const { typeName } = useOrderText();
  return (
    <SectionCard variant="panel" id="writer-week" title={t('week.title')}>
      {week.length === 0 ? (
        <p className="m-0 text-sm leading-7 text-text-2">{t('week.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {week.map((item) => (
            <li key={`${String(item.order)}-${item.due_at}`}>
              <Link to={orderPath(item.order)} className="flex items-center gap-3 text-text">
                <DateTile value={item.due_at} highlight={false} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="sr-only">{f.weekday(item.due_at)}</span>
                  <span className="text-[15px] font-semibold">{item.applicant}</span>
                  <span className="text-[13px] text-text-2">
                    {t('week.what', {
                      type: typeName(item.type),
                      version: t(`week.next.${item.next}`, { n: f.number(item.draft) }),
                    })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** Open orders against the writer's limit. */
export function CapacityCard({ capacity }: { capacity: QueueData['capacity'] }) {
  const { t } = useTranslation('writer');
  const f = useFormat();
  return (
    <SectionCard variant="panel" id="writer-capacity" title={t('capacity.title')}>
      <div className="flex justify-between gap-3 text-sm">
        <span>{t('capacity.open', { n: f.number(capacity.open) })}</span>
        <span className="text-text-2">{t('capacity.max', { n: f.number(capacity.max) })}</span>
      </div>
      <ProgressBar
        value={percentOf(capacity.open, capacity.max)}
        tone={capacity.open >= capacity.max ? 'warn' : 'primary'}
        label={t('capacity.title')}
      />
      <span className="text-[13px] leading-7 text-text-2">{t('capacity.note')}</span>
    </SectionCard>
  );
}

/** The writing team's guides. */
export function GuidesCard({ guides }: { guides: QueueData['guides'] }) {
  const { t } = useTranslation('writer');
  if (guides.length === 0) return null;
  return (
    <SectionCard variant="panel" id="writer-guides" title={t('guides.title')}>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {guides.map((guide) => (
          <li key={guide.url}>
            <a
              href={safeHref(guide.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center text-[15px] font-medium"
            >
              {guide.title}
            </a>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
