import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import type { TasksOverview } from '@/lib/tasks/api';
import type { TasksConfig } from '../config';

const SHOWN = 5;

/** Active people with no next step: the ones who get forgotten. */
export function Orphans({
  orphans,
  config,
}: {
  orphans: TasksOverview['orphans'];
  config: TasksConfig;
}) {
  const { t } = useTranslation('tasks');
  const f = useFormat();
  const first = orphans[0];
  return (
    <section
      aria-labelledby="orphans-title"
      className="flex flex-wrap items-center justify-between gap-4 rounded-card-sm bg-warn-tint px-5 py-4 lg:rounded-card lg:px-7"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-warn">
          <Icon name="alert" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="orphans-title" className="m-0 text-base font-bold text-warn">
            {t(`orphans.title.${config.person}`, { n: f.number(orphans.length) })}
          </h2>
          <span className="text-sm leading-6 text-neutral">
            {t(`orphans.text.${config.person}`)}
          </span>
          <span className="text-sm text-neutral">
            {f.list(orphans.slice(0, SHOWN).map((person) => person.name))}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex" aria-hidden="true">
          {orphans.slice(0, SHOWN).map((person) => (
            <Avatar key={person.id} name={person.name} size="sm" stacked />
          ))}
        </span>
        {first && (
          <Link to={config.personPath(first.id)} className={buttonClass('outline')}>
            {t('orphans.action')}
          </Link>
        )}
      </div>
    </section>
  );
}
