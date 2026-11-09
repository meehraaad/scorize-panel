import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { StageChoice } from '@/lib/sales/contactDrafts';
import type { Lane } from '../boardLanes';

/**
 * Where the lead is now, on one segmented track of the board's lanes: the same columns the sales
 * manager set up for the board (S48). The current lane means "keep"; earlier lanes and the
 * contract ones (made from the offer page) can't be picked. "Lost?" is a quiet choice under the
 * track. Canvas "پاپ‌آپ تماس", board 2.
 */
export function StageStrip({
  lanes,
  current,
  movable,
  lostAllowed,
  value,
  onChange,
}: {
  lanes: readonly Lane[];
  /** The lane the lead is in now. */
  current: Lane | null;
  /** Lanes this log may move the lead to (the columns after the current one). */
  movable: readonly Lane[];
  lostAllowed: boolean;
  /** `keep`, `lost`, or the picked lane's key. */
  value: StageChoice;
  onChange: (value: StageChoice) => void;
}) {
  const { t } = useTranslation('sales');
  const group = useId();
  const noteId = useId();
  const lost = value === 'lost';
  const target = value === 'keep' ? current : lanes.find((lane) => lane.key === value);
  const note = lost
    ? t('customer.logDialog.board.lostNote')
    : t(value === 'keep' ? 'customer.logDialog.board.stays' : 'customer.logDialog.board.moves', {
        stage: target?.name ?? '',
      });

  return (
    <fieldset aria-describedby={noteId} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-3 p-0 text-sm font-semibold text-text-2">
        {t('customer.logDialog.board.legend')}
      </legend>
      <div className="overflow-x-auto">
        <div className="grid min-w-max auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-track p-1">
          {lanes.map((lane) => {
            const isCurrent = lane === current;
            const option: StageChoice | null = isCurrent
              ? 'keep'
              : movable.includes(lane)
                ? (lane.key as StageChoice)
                : null;
            const chosen = !lost && lane === target;
            return (
              <label
                key={lane.key}
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
                  aria-label={lane.name}
                />
                {lane.label}
              </label>
            );
          })}
        </div>
      </div>
      {lostAllowed && (
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
