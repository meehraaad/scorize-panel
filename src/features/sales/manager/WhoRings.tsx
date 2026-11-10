import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { TeamBreakPerson } from '@/lib/sales/phoneCalls';

/** Who gets team calls now: everyone a team can ring, with today's breaks first. */
export function WhoRings({ people }: { people: TeamBreakPerson[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const resting = people.filter((person) => person.on_break);
  const sorted = [...resting, ...people.filter((person) => !person.on_break)];
  return (
    <SectionCard
      id="phone-team-breaks"
      variant="panel"
      title={t('manager.teams.breaks.title')}
      subtitle={
        resting.length > 0
          ? t('manager.teams.breaks.resting', {
              count: resting.length,
              n: f.number(resting.length),
            })
          : t('manager.teams.breaks.none')
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {sorted.map((person) => (
          <li
            key={person.id}
            className="flex min-h-14 items-center gap-3 border-b border-line-2 py-2 last:border-b-0"
          >
            <Avatar name={person.name} size="sm" tone={person.on_break ? 'tint' : 'hero'} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold text-text">{person.name}</span>
              <span className="text-[13px] text-text-2">
                {person.teams.length > 0 ? f.list(person.teams) : t('manager.teams.breaks.noTeam')}
              </span>
            </div>
            {person.on_break && person.since ? (
              <Chip tone="warn" dot>
                {t('manager.teams.breaks.since', { time: f.time(person.since) })}
              </Chip>
            ) : person.teams.length > 0 ? (
              <Chip tone="good" dot>
                {t('manager.teams.breaks.ringing')}
              </Chip>
            ) : (
              <Chip tone="neutral">{t('manager.teams.breaks.outside')}</Chip>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
