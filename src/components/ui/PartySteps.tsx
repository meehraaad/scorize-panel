import { Icon } from './Icon';

export interface PartyStep {
  key: string;
  /** The role ("Consultant"). */
  label: string;
  /** Who it is; empty when not known yet. */
  name: string;
  done: boolean;
}

/**
 * Who has done their part, as a row of dots (a check when done) joined by a line: the parties of
 * a contract agreeing on one version. `label` names the list for screen readers; `doneLabel` /
 * `waitingLabel` say each step's state.
 */
export function PartySteps({
  steps,
  label,
  doneLabel,
  waitingLabel,
}: {
  steps: PartyStep[];
  label: string;
  doneLabel: string;
  waitingLabel: string;
}) {
  return (
    <ol aria-label={label} className="m-0 flex list-none gap-1 overflow-x-auto p-0">
      {steps.map((step, index) => (
        <li key={step.key} className="flex min-w-[76px] flex-1 flex-col items-center gap-1.5">
          <span className="relative flex w-full items-center justify-center">
            {index > 0 && (
              <span
                aria-hidden="true"
                className={`absolute end-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 ${
                  step.done ? 'bg-good' : 'bg-track'
                }`}
              />
            )}
            <span
              className={`relative flex size-7 items-center justify-center rounded-full ${
                step.done
                  ? 'bg-good text-on-primary'
                  : 'bg-surface shadow-[inset_0_0_0_2px_var(--line-3)]'
              }`}
            >
              {step.done && <Icon name="check" size={14} />}
            </span>
          </span>
          <span className="text-center text-xs font-semibold">{step.label}</span>
          {step.name && (
            <span className="max-w-full truncate text-center text-xs text-text-2">{step.name}</span>
          )}
          <span className="sr-only">{step.done ? doneLabel : waitingLabel}</span>
        </li>
      ))}
    </ol>
  );
}
