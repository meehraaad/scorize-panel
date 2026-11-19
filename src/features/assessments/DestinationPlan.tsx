import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { buttonClass } from '@/components/ui/buttonStyles';
import type { DestinationResult, PlanAction } from './destinationApi';

export function DestinationPlan({
  data,
  disabled = false,
  onSelect,
  onProgress,
}: {
  data: DestinationResult | Omit<DestinationResult, 'decision_sha256' | 'writable'>;
  disabled?: boolean;
  onSelect?: (routes: string[]) => void;
  onProgress?: (action: PlanAction, status: 'todo' | 'in_progress' | 'done') => void;
}) {
  const { t, i18n } = useTranslation('assessments');
  const plan = data.plan;
  if (!plan) return null;
  const lang = i18n.language === 'fa' ? 'fa' : 'en';
  const labels = t('destinationPlan.actions', { returnObjects: true }) as Record<string, string>;
  const statuses = t('destinationPlan.statuses', { returnObjects: true }) as Record<string, string>;
  return (
    <section aria-label={t('destinationPlan.title')} className="flex min-w-0 flex-col gap-4">
      <h2 className="text-lg font-bold">{t('destinationPlan.title')}</h2>
      <Notice tone="info">{t('destinationPlan.meaning')}</Notice>
      {!plan.routes.length && <p>{t('destinationPlan.empty', { max: plan.max_routes })}</p>}
      {plan.routes.map((route, index) => (
        <div key={route.id} className="border-line min-w-0 rounded-2xl border p-4 break-words">
          <h3 className="font-bold">
            {route.title?.[lang] ?? t('destinationPlan.removed', { id: route.id })}
          </h3>
          {!route.available && <Notice tone="warn">{t('destinationPlan.unavailable')}</Notice>}
          {onSelect && (
            <div className="my-3 flex flex-wrap gap-3">
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => onSelect(plan.selected_routes.filter((id) => id !== route.id))}
              >
                {t('destinationPlan.remove')}
              </Button>
              {index > 0 && (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    const next = [...plan.selected_routes];
                    const previous = next[index - 1];
                    if (previous === undefined) return;
                    next[index - 1] = route.id;
                    next[index] = previous;
                    onSelect(next);
                  }}
                >
                  {t('destinationPlan.earlier')}
                </Button>
              )}
            </div>
          )}
          <ol className="flex flex-col gap-4">
            {route.actions.map((action) => (
              <li key={action.id}>
                <p className="font-semibold">
                  {labels[action.kind] ?? t('destinations.specialist')}
                </p>
                {action.basis_changed && (
                  <Notice tone="warn">
                    {t('destinationPlan.recheck', { previous: statuses[action.reported_status] })}
                  </Notice>
                )}
                {action.depends_on.length > 0 && <p>{t('destinationPlan.dependencies')}</p>}
                {onProgress ? (
                  <SelectField
                    label={t('destinationPlan.progress', { action: labels[action.kind] })}
                    value={action.status}
                    disabled={disabled}
                    options={[
                      ...(action.status === 'needs_recheck'
                        ? [
                            {
                              value: 'needs_recheck',
                              label: statuses.needs_recheck ?? t('calculator.unknown'),
                            },
                          ]
                        : []),
                      ...(['todo', 'in_progress', 'done'] as const).map((value) => ({
                        value,
                        label: statuses[value] ?? t('calculator.unknown'),
                      })),
                    ]}
                    onChange={(status) => {
                      if (status === 'todo' || status === 'in_progress' || status === 'done')
                        onProgress(action, status);
                    }}
                  />
                ) : (
                  <p>{statuses[action.status]}</p>
                )}
                {action.recorded_at && (
                  <p className="text-sm text-text-2">
                    {t('destinationPlan.recorded', { date: action.recorded_at })}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {route.interview && !disabled && onProgress && (
            <Link
              className={buttonClass('outline', 'mt-3')}
              to={`/dev/assessment-calculators?session=${encodeURIComponent(data.context.session_id)}&country=${route.interview.country}&route=${encodeURIComponent(route.interview.route_id)}`}
            >
              {t('destinationPlan.openInterview')}
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
