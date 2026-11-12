import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { ProgressBar } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useMoveAction, useSetStep, type Move, type MoveStep, type Named } from '../api';
import { dayOf, daysUntil } from '../format';
import { PersonLink } from './PersonLink';

/**
 * A joining or a leaving with its checklist. Each step is a task of its owner (on their tasks page
 * and calendar): ticking it here closes that task. A leaving is finished on or after its last day
 * (the person loses their access); either can be cancelled.
 */
export function MoveCard({
  move,
  staff,
}: {
  move: Move & { steps: MoveStep[] };
  /** Shown on lists of everyone's moves; left out inside the person's own file. */
  staff?: Named;
}) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const setStep = useSetStep();
  const action = useMoveAction();
  const [confirm, setConfirm] = useState<'finish' | 'cancel' | null>(null);
  const open = move.status === 'open';
  const days = daysUntil(move.day);
  const done = move.steps.filter((step) => step.done).length;
  const title = t(`move.${move.kind}`);
  const when =
    days === 0
      ? t('move.today')
      : days > 0
        ? t('move.inDays', { n: f.number(days) })
        : t('move.daysAgo', { n: f.number(-days) });

  const run = (kind: 'finish' | 'cancel') =>
    action.mutate(
      { id: move.id, action: kind },
      {
        onSuccess: () => {
          setConfirm(null);
          toast.success(t(kind === 'finish' ? 'move.finished' : 'move.cancelled'));
        },
        onError: () => toast.error(t('error')),
      },
    );

  return (
    <Card
      aria-label={staff ? `${title} · ${staff.name}` : title}
      className="flex flex-col gap-4 p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        {staff && (
          <div className="min-w-0 flex-1">
            <PersonLink id={staff.id} name={staff.name} sub={title} />
          </div>
        )}
        {!staff && <h3 className="m-0 flex-1 text-base font-bold">{title}</h3>}
        <Chip tone={move.kind === 'entry' ? 'primary' : 'warn'} small>
          {t(move.kind === 'entry' ? 'move.firstDay' : 'move.lastDay', {
            day: f.date(dayOf(move.day)),
          })}
        </Chip>
        {open ? (
          <span className="text-xs text-text-2">{when}</span>
        ) : (
          <Chip tone={move.status === 'done' ? 'good' : 'neutral'} small>
            {t(`move.status.${move.status}`)}
          </Chip>
        )}
      </div>
      {move.reason && <p className="m-0 text-sm text-text-2">{move.reason}</p>}
      <ProgressBar
        value={move.steps.length ? Math.round((done / move.steps.length) * 100) : 0}
        tone={done === move.steps.length ? 'good' : 'primary'}
        label={t('move.progress', { done: f.number(done), total: f.number(move.steps.length) })}
      />
      <ul aria-label={t('move.steps')} className="m-0 flex list-none flex-col gap-1 p-0">
        {move.steps.map((step) => (
          <li key={step.id}>
            <label
              className={`flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 has-focus-visible:outline-2 has-focus-visible:outline-focus ${open ? 'cursor-pointer hover:bg-canvas' : ''}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={step.done}
                disabled={!open || setStep.isPending}
                onChange={(event) =>
                  setStep.mutate(
                    { id: step.id, done: event.target.checked },
                    { onError: () => toast.error(t('error')) },
                  )
                }
              />
              <span
                aria-hidden="true"
                className={`flex size-5 flex-none items-center justify-center rounded-md ${
                  step.done ? 'bg-good text-on-primary' : 'shadow-[inset_0_0_0_2px_var(--line-3)]'
                }`}
              >
                {step.done && <Icon name="check" size={13} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`text-[15px] ${step.done ? 'text-text-2 line-through' : 'font-medium'}`}
                >
                  {step.label}
                </span>
                <span className="text-xs text-text-2">
                  {[
                    step.owner?.name,
                    step.due && !step.done && t('move.due', { day: f.dateShort(dayOf(step.due)) }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {open &&
        (confirm ? (
          <InlineConfirm
            message={t(confirm === 'finish' ? 'move.finishConfirm' : 'move.cancelConfirm')}
            confirmLabel={t(confirm === 'finish' ? 'move.finish' : 'move.cancel')}
            cancelLabel={t('back')}
            pending={action.isPending}
            onConfirm={() => run(confirm)}
            onCancel={() => setConfirm(null)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {move.kind === 'exit' && (
              <Button
                variant="outline"
                disabled={days > 0}
                title={days > 0 ? t('move.finishLater') : undefined}
                onClick={() => setConfirm('finish')}
              >
                {t('move.finish')}
              </Button>
            )}
            <Button variant="danger" onClick={() => setConfirm('cancel')}>
              {t('move.cancel')}
            </Button>
          </div>
        ))}
    </Card>
  );
}
