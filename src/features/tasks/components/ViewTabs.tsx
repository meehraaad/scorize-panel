import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';

const VIEWS = ['mine', 'requests', 'team'] as const;
export type View = (typeof VIEWS)[number];

/** The three behaviours of a task: my follow-ups, requests to me, my teams' queues. */
export function ViewTabs({
  value,
  onChange,
  counts,
}: {
  value: View;
  onChange: (view: View) => void;
  counts: Record<View, number>;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  return (
    <div role="group" aria-label={t('views')} className="grid gap-2 sm:grid-cols-3">
      {VIEWS.map((view) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => onChange(view)}
          className="flex min-h-11 flex-col items-start gap-1 rounded-card-sm px-5 py-3.5 text-start shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)] aria-pressed:bg-surface aria-pressed:shadow-panel"
        >
          <span className="flex items-center gap-2 text-[15px] font-bold">
            {t(`view.${view}.label`)}
            {counts[view] > 0 && <Badge>{f.number(counts[view])}</Badge>}
          </span>
          <span className="text-xs text-text-2">{t(`view.${view}.hint`)}</span>
        </button>
      ))}
    </div>
  );
}
