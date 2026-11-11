import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Change } from '../api';

/** A message's last changes, newest first; each but the newest can be brought back. */
export function History({
  id,
  changes,
  onRestore,
}: {
  id: string;
  changes: readonly Change[];
  /** Left out where a version can't be brought back. */
  onRestore?: ((change: Change) => void) | undefined;
}) {
  const { t } = useTranslation('messages');
  const f = useFormat();
  return (
    <section aria-labelledby={`${id}-history`} className="flex flex-col gap-2">
      <h3 id={`${id}-history`} className="m-0 text-base font-bold">
        {t('history.title')}
      </h3>
      {changes.length === 0 ? (
        <p className="m-0 text-sm text-text-2">{t('history.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {changes.map((change, index) => (
            <li key={change.id} className="flex flex-col gap-1.5 rounded-2xl bg-canvas px-4 py-3">
              <span className="text-[13px] text-text-2">
                {t('history.by', {
                  who: change.by?.name ?? t('dash'),
                  when: f.timeAgo(change.at),
                })}
                {!change.is_active && ` · ${t('history.off')}`}
              </span>
              {change.text && (
                <p className="m-0 line-clamp-3 text-sm leading-7 whitespace-pre-wrap">
                  {change.text}
                </p>
              )}
              {onRestore && index > 0 && change.text && (
                <Button variant="outline" className="self-start" onClick={() => onRestore(change)}>
                  {t('history.restore')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
