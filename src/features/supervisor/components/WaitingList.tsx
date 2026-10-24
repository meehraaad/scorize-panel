import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import type { WaitingCase } from '../api';
import { casePath } from '../paths';
import { useCaseLine } from './useCaseLine';

/** Cases with something for the supervisor to do now, the most urgent first. */
export function WaitingList({ cases }: { cases: readonly WaitingCase[] }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const line = useCaseLine();

  return (
    <SectionCard
      id="waiting-cases"
      title={t('today.waiting.title')}
      subtitle={cases.length > 0 ? t('today.waiting.subtitle') : undefined}
    >
      {cases.length === 0 ? (
        <EmptyState title={t('today.waiting.emptyTitle')}>{t('today.waiting.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {cases.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 ${
                item.urgent ? 'bg-row-highlight' : ''
              }`}
            >
              <span className="flex min-w-0 flex-[1_1_240px] items-center gap-3">
                <Avatar name={item.name} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    to={casePath(item.id)}
                    className="truncate text-base font-semibold text-text hover:underline"
                  >
                    {item.name}
                  </Link>
                  <span className="truncate text-[13px] text-text-2">{line(item)}</span>
                </span>
              </span>
              <span className="flex min-w-0 flex-[2_1_260px] items-start gap-2 text-[15px] leading-7">
                <span
                  aria-hidden="true"
                  className={`mt-2.5 size-2 flex-none rounded-full ${item.urgent ? 'bg-urgent' : 'bg-track'}`}
                />
                <span>
                  {item.urgent && <span className="sr-only">{t('today.waiting.urgent')} </span>}
                  {item.todo}
                </span>
              </span>
              <span className="flex flex-[0_0_120px] flex-col gap-0.5">
                <span className="text-xs text-text-2">{t('today.waiting.nextDeadline')}</span>
                <span
                  className={`text-sm font-semibold ${
                    item.next_deadline && daysUntil(item.next_deadline) <= 7
                      ? 'text-urgent'
                      : 'text-text'
                  }`}
                >
                  {item.next_deadline
                    ? t('today.waiting.daysLeft', {
                        n: f.number(daysUntil(item.next_deadline)),
                      })
                    : t('dash')}
                </span>
              </span>
              <span className="flex flex-[0_0_120px] flex-col gap-1.5">
                <span className="text-xs text-text-2">
                  {t('docs', {
                    uploaded: f.number(item.docs.uploaded),
                    required: f.number(item.docs.required),
                  })}
                </span>
                <ProgressBar
                  size="sm"
                  value={percentOf(item.docs.uploaded, item.docs.required)}
                  tone={item.docs.uploaded >= item.docs.required ? 'good' : 'primary'}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
