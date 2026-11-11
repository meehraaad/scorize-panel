import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';

/**
 * The customer's open follow-up, on top of a window that sets the next step (the follow-up
 * window, the in-person meeting), with "talked to them? log it" when the window can open the log.
 */
export function FollowUpNow({
  at,
  text,
  timed = true,
  onLog,
}: {
  at: Date | string | null;
  text?: string | undefined;
  /** False: a day-only follow-up (`at` is its 23:59), shown without the hour. */
  timed?: boolean | undefined;
  onLog?: (() => void) | undefined;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  if (!at && !onLog) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card-sm bg-tint px-4 py-2 text-sm leading-6">
      {at && (
        <span className="flex min-w-0 items-start gap-2.5 py-1">
          <Icon name="clock" size={17} className="mt-0.5 flex-none text-text-2" />
          <span>
            {t('followUpDialog.now', {
              when: timed
                ? t('followUpDialog.when', { day: f.weekday(at), time: f.time(at) })
                : f.weekday(at),
            })}
            {text ? ` · ${text}` : ''}
          </span>
        </span>
      )}
      {onLog && (
        <button
          type="button"
          onClick={onLog}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Icon name="phone" size={16} />
          {t('followUpDialog.log')}
        </button>
      )}
    </div>
  );
}
