import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import type { LeadStage } from '@/lib/sales/api';
import type { ContactValues } from '@/lib/sales/contactDrafts';

/** The board's stages left to right (team columns sit inside the middle ones). */
const LANES = ['new', 'contacted', 'consulted', 'offer', 'draft', 'won'] as const;

type Choice = ContactValues['stage'];
/** The lanes a log can move a card into (drafts and contracts come from the offer page). */
const PICKABLE = ['contacted', 'consulted', 'offer'] as const satisfies readonly Choice[];

/**
 * Where the lead's card goes on the board, picked on a small copy of the board: one lane per
 * stage, the card in the chosen lane with its next follow-up. The current lane means "keep";
 * earlier lanes and the contract lanes (made from the offer page) can't be picked. "Lost" sits
 * apart under the lanes.
 */
export function StageStrip({
  name,
  current,
  movable,
  value,
  onChange,
  followText,
}: {
  /** The customer, on the card. */
  name: string;
  current: LeadStage;
  /** Stages this log may move the lead to (forward ones and `lost`). */
  movable: readonly LeadStage[];
  value: Choice;
  onChange: (value: Choice) => void;
  /** The follow-up the log creates, shown on the card; null when none. */
  followText: string | null;
}) {
  const { t } = useTranslation('sales');
  const group = useId();
  const noteId = useId();
  const lost = value === 'lost';
  const target: LeadStage = value === 'keep' ? current : value;
  const note = lost
    ? t('customer.logDialog.board.lostNote')
    : t(value === 'keep' ? 'customer.logDialog.board.stays' : 'customer.logDialog.board.moves', {
        stage: t(`stage.${target}`),
      });

  return (
    <fieldset aria-describedby={noteId} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-3 p-0 text-sm font-semibold text-text-2">
        {t('customer.logDialog.board.legend')}
      </legend>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-1.5 sm:min-w-0">
          {LANES.map((lane) => {
            const isCurrent = lane === current;
            const option: Choice | null = isCurrent
              ? 'keep'
              : (PICKABLE.find((stage) => stage === lane && movable.includes(stage)) ?? null);
            const chosen = !lost && lane === target;
            return (
              <label
                key={lane}
                className={`relative flex min-h-32 w-[88px] flex-col gap-2 rounded-xl p-1.5 sm:w-auto sm:flex-1 ${
                  option
                    ? 'cursor-pointer bg-board-lane hover:shadow-[inset_0_0_0_1px_var(--line-3)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus'
                    : 'bg-board-lane opacity-45'
                } ${chosen ? 'shadow-[inset_0_0_0_2px_var(--primary)]' : ''}`}
              >
                <input
                  type="radio"
                  name={group}
                  className="sr-only"
                  checked={chosen}
                  disabled={!option}
                  onChange={() => option && onChange(option)}
                  aria-label={t(`stage.${lane}`)}
                />
                <span
                  className={`truncate px-1 pt-0.5 text-xs font-semibold ${chosen ? 'text-primary-text' : 'text-text-2'}`}
                >
                  {t(`stageShort.${lane}`)}
                </span>
                {chosen ? (
                  <span className="flex flex-col gap-1.5 rounded-lg border border-hair bg-surface p-2 shadow-board-card">
                    <span className="line-clamp-2 text-xs leading-5 font-semibold">{name}</span>
                    {followText && (
                      <span className="flex items-start gap-1 text-[11px] leading-4 text-text-2">
                        <Icon name="clock" size={12} className="mt-0.5 flex-none" />
                        {followText}
                      </span>
                    )}
                  </span>
                ) : (
                  isCurrent && (
                    <span className="rounded-lg border border-dashed border-line-3 p-2 text-[11px] leading-4 text-text-2">
                      {t('customer.logDialog.board.now')}
                    </span>
                  )
                )}
              </label>
            );
          })}
        </div>
      </div>
      {movable.includes('lost') && (
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full px-4 text-sm font-medium text-danger shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-danger-tint has-checked:bg-danger-tint has-checked:shadow-[inset_0_0_0_1.5px_var(--danger)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
          <input
            type="radio"
            name={group}
            className="sr-only"
            checked={lost}
            onChange={() => onChange('lost')}
          />
          <Icon name="close" size={16} />
          {t('customer.logDialog.board.lost')}
        </label>
      )}
      <p id={noteId} aria-live="polite" className="m-0 text-[13px] leading-6 text-text-2">
        {note}
      </p>
    </fieldset>
  );
}
