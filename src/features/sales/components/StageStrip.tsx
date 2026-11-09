import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeadStage } from '@/lib/sales/api';
import type { ContactValues } from '@/lib/sales/contactDrafts';

/** The board's stages left to right (team columns sit inside the middle ones). */
const LANES = ['new', 'contacted', 'consulted', 'offer', 'draft', 'won'] as const;

type Choice = ContactValues['stage'];
/** The lanes a log can move a card into (drafts and contracts come from the offer page). */
const PICKABLE = ['contacted', 'consulted', 'offer'] as const satisfies readonly Choice[];

/**
 * Where the lead is now, on one segmented track of the board's stages. The current stage means
 * "keep"; earlier stages and the contract ones (made from the offer page) can't be picked. "Lost?"
 * is a quiet choice under the track. Canvas "پاپ‌آپ تماس", board 2.
 */
export function StageStrip({
  current,
  movable,
  value,
  onChange,
}: {
  current: LeadStage;
  /** Stages this log may move the lead to (forward ones and `lost`). */
  movable: readonly LeadStage[];
  value: Choice;
  onChange: (value: Choice) => void;
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
      <div className="overflow-x-auto">
        <div className="grid min-w-max auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-track p-1">
          {LANES.map((lane) => {
            const isCurrent = lane === current;
            const option: Choice | null = isCurrent
              ? 'keep'
              : (PICKABLE.find((stage) => stage === lane && movable.includes(stage)) ?? null);
            const chosen = !lost && lane === target;
            return (
              <label
                key={lane}
                className={`flex min-h-11 items-center justify-center rounded-[10px] px-3 text-center text-[13px] leading-5 whitespace-nowrap has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${
                  chosen
                    ? 'bg-surface font-semibold text-text shadow-panel'
                    : option
                      ? 'cursor-pointer text-text-2 hover:text-text'
                      : 'text-text-3'
                }`}
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
                {t(`stageShort.${lane}`)}
              </label>
            );
          })}
        </div>
      </div>
      {movable.includes('lost') && (
        <label className="-mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start rounded-full px-3 text-[13px] text-text-2 underline-offset-4 hover:text-danger hover:underline has-checked:bg-danger-tint has-checked:font-semibold has-checked:text-danger has-checked:no-underline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
          <input
            type="radio"
            name={group}
            className="sr-only"
            checked={lost}
            onChange={() => onChange('lost')}
            aria-label={t('customer.logDialog.board.lost')}
          />
          {t('customer.logDialog.board.lostAsk')}
        </label>
      )}
      <p id={noteId} aria-live="polite" className="m-0 text-[13px] leading-6 text-text-2">
        {note}
      </p>
    </fieldset>
  );
}
