import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import type { TasksOverview } from '@/lib/tasks/api';

/** "86% on time this week": the team's measure instead of per-task penalties. */
export function OnTime({ onTime }: { onTime: NonNullable<TasksOverview['on_time']> }) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const percent = (share: number) => t('percent', { n: f.number(Math.round(share * 100)) });
  const good = onTime.week >= onTime.target;
  return (
    <div className="flex items-center gap-3 rounded-full bg-surface py-2 ps-2 pe-5 shadow-panel">
      <span
        className={`flex size-12 flex-none items-center justify-center rounded-full text-sm font-bold ${good ? 'bg-good-tint text-good' : 'bg-warn-tint text-warn'}`}
      >
        {percent(onTime.week)}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{t('onTime.label')}</span>
        <span className="text-xs text-text-2">
          {t('onTime.note', { last: percent(onTime.last_week), target: percent(onTime.target) })}
        </span>
      </span>
    </div>
  );
}
