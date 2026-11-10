import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { useBreak } from './usePhoneStatus';

const itemClass =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[15px] text-text hover:bg-canvas disabled:opacity-50';

/**
 * Account menu block: the seller's phone status and the break button (a break from team calls:
 * lunch, a meeting). Only for sellers a team can ring (a desk phone or a mobile extension).
 */
export function PhoneBreakMenu() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data, toggle, pending } = useBreak();
  if (!data?.can) return null;
  const onBreak = data.on_break;

  return (
    <div className="flex flex-col gap-1 border-t border-hair pt-1">
      <div role="status" className="flex flex-col gap-1 px-3 py-2 text-sm text-text-2">
        <span className="flex items-center gap-2 font-medium text-text">
          <span
            aria-hidden="true"
            className={`size-2.5 flex-none rounded-full ${onBreak ? 'bg-(--hue-orange)' : 'bg-(--hue-green)'}`}
          />
          {onBreak && data.since
            ? t('phoneBreak.on', { time: f.time(data.since) })
            : t(onBreak ? 'phoneBreak.onShort' : 'phoneBreak.inQueue')}
        </span>
        {onBreak && (
          <span>
            {data.teams.length > 0 && `${t('phoneBreak.teams', { teams: f.list(data.teams) })} `}
            {t('phoneBreak.direct')}
          </span>
        )}
      </div>
      <button
        type="button"
        className={itemClass}
        onClick={() => toggle(!onBreak)}
        disabled={pending}
        title={onBreak ? undefined : t('phoneBreak.hint')}
      >
        <Icon name={onBreak ? 'phone' : 'pause'} />
        {onBreak ? t('phoneBreak.end') : t('phoneBreak.start')}
      </button>
    </div>
  );
}
