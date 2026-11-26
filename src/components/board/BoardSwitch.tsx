import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

/** The capsule over a team board: it or mine (links: each is its own address). */
export function BoardSwitch({
  team,
  teamTo,
  mine,
}: {
  /** The team board's name («برد فروش»). */
  team: string;
  /** Its address; mine is the same with `?board=mine`. */
  teamTo: string;
  mine: boolean;
}) {
  const { t } = useTranslation('tasks');
  const pill = (on: boolean) =>
    `inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-focus ${
      on ? 'bg-hero text-on-hero dark:bg-tint' : 'text-text-2 hover:text-text'
    }`;
  return (
    <nav aria-label={t('board.which')} className="flex rounded-full bg-surface p-1 shadow-panel">
      <Link to={teamTo} aria-current={mine ? undefined : 'page'} className={pill(!mine)}>
        {team}
      </Link>
      <Link
        to={`${teamTo}?board=mine`}
        aria-current={mine ? 'page' : undefined}
        className={pill(mine)}
      >
        {t('board.title')}
      </Link>
    </nav>
  );
}
