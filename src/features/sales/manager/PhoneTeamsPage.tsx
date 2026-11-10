import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TogglePill } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  phoneTeamsQuery,
  useSavePhoneTeam,
  type PhoneTeam,
  type TeamPerson,
} from '@/lib/sales/phoneCalls';
import { toLatinNumber } from '@/lib/text';
import { toast } from '@/lib/toast';

const MOBILE = /^09\d{9}$/;
const NAME = /^[^\r\n;,|\\[\]"<>]{1,40}$/;

/** "۰۹۱۲ ۱۲۳ ۴۵۶۷" → "09121234567". */
const phoneOf = (value: string) => toLatinNumber(value).replace(/[\s-]/g, '');

/**
 * The teams the office line rings (manager section): each team's name, the people who ring in it
 * (their desk phone, which rings their mobile too, or their mobile extension) and outside
 * numbers. A team the PBX has but no one saved here shows what it rings today.
 */
export default function PhoneTeamsPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(phoneTeamsQuery);

  return (
    <>
      <PageHeader
        title={t('manager.teams.title')}
        subtitle={
          data.seen_at
            ? t('manager.teams.seen', { time: f.dateTime(data.seen_at) })
            : t('manager.teams.notSeen')
        }
      />
      {data.teams.length === 0 ? (
        <SectionCard id="phone-teams-empty" variant="panel" title={t('manager.teams.title')}>
          <EmptyState>{t('manager.teams.empty')}</EmptyState>
        </SectionCard>
      ) : (
        data.teams.map((team) => <TeamCard key={team.number} team={team} people={data.people} />)
      )}
      <NewTeam />
    </>
  );
}

function TeamCard({ team, people }: { team: PhoneTeam; people: TeamPerson[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSavePhoneTeam();
  const [name, setName] = useState(team.name);
  const [members, setMembers] = useState(team.members);
  const [outside, setOutside] = useState(team.outside_numbers);
  const [typed, setTyped] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [phoneError, setPhoneError] = useState<string>();

  const addPhone = () => {
    const phone = phoneOf(typed);
    if (!MOBILE.test(phone)) {
      setPhoneError(t('manager.teams.phoneHint'));
      return;
    }
    setOutside((list) => [...new Set([...list, phone])]);
    setTyped('');
  };

  const submit = () => {
    if (!NAME.test(name.trim())) {
      setNameError(t('manager.teams.nameHint'));
      document.getElementById(`team-${team.number}-name`)?.focus();
      return;
    }
    save.mutate(
      { number: team.number, name: name.trim(), members, outside_numbers: outside },
      {
        onSuccess: () => toast.success(t('manager.teams.saved', { name: name.trim() })),
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 400
              ? t('manager.teams.refused')
              : t('error'),
          ),
      },
    );
  };

  const title = team.name || t('manager.teams.untitled', { number: f.digits(team.number) });
  return (
    <SectionCard
      id={`phone-team-${team.number}`}
      variant="panel"
      title={title}
      subtitle={t(team.saved ? 'manager.teams.number' : 'manager.teams.fromPbx', {
        number: f.digits(team.number),
      })}
    >
      <form
        aria-label={t('manager.teams.formLabel', { name: title })}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          id={`team-${team.number}-name`}
          label={t('manager.teams.name')}
          value={name}
          maxLength={40}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(undefined);
          }}
          error={nameError}
        />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-semibold text-text-2">
            {t('manager.teams.members')}
          </legend>
          {people.length === 0 ? (
            <p className="m-0 text-[13px] text-text-2">{t('manager.teams.noPeople')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <TogglePill
                  key={person.id}
                  label={`${person.name} · ${f.digits(person.desk ?? person.mobile ?? '')}`}
                  checked={members.includes(person.id)}
                  onChange={(on) =>
                    setMembers((list) =>
                      on ? [...list, person.id] : list.filter((id) => id !== person.id),
                    )
                  }
                />
              ))}
            </div>
          )}
          <p className="m-0 text-[13px] text-text-2">{t('manager.teams.membersHint')}</p>
        </fieldset>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-56 flex-1">
              <TextField
                label={t('manager.teams.outside')}
                inputMode="tel"
                dir="ltr"
                value={typed}
                placeholder="09121234567"
                onChange={(event) => {
                  setTyped(event.target.value);
                  setPhoneError(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addPhone();
                  }
                }}
                error={phoneError}
              />
            </div>
            <Button variant="outline" className="mt-7" onClick={addPhone}>
              {t('manager.teams.addPhone')}
            </Button>
          </div>
          {outside.length > 0 && (
            <ul className="m-0 flex list-none flex-col p-0">
              {outside.map((phone) => (
                <li
                  key={phone}
                  className="flex min-h-12 items-center justify-between gap-2 border-b border-line-2 last:border-b-0"
                >
                  <span dir="ltr" className="text-[15px] text-text">
                    {f.digits(phone)}
                  </span>
                  <IconButton
                    icon="trash"
                    tone="danger"
                    aria-label={t('manager.teams.removePhone', { phone: f.digits(phone) })}
                    onClick={() => setOutside((list) => list.filter((value) => value !== phone))}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        {team.unknown.length > 0 && (
          <p className="m-0 text-[13px] text-text-2">
            {t('manager.teams.unknown', { list: f.digits(team.unknown.join('، ')) })}
          </p>
        )}
        {team.dynamic.length > 0 && (
          <p className="m-0 text-[13px] text-text-2">
            {t('manager.teams.dynamic', { list: f.digits(team.dynamic.join('، ')) })}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {t('manager.teams.save')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/** A new team gets the next free number; its people are picked on its card afterwards. */
function NewTeam() {
  const { t } = useTranslation('sales');
  const save = useSavePhoneTeam();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  const submit = () => {
    if (!NAME.test(name.trim())) {
      setError(t('manager.teams.nameHint'));
      document.getElementById('new-team-name')?.focus();
      return;
    }
    save.mutate(
      { name: name.trim(), members: [], outside_numbers: [] },
      {
        onSuccess: () => {
          toast.success(t('manager.teams.added', { name: name.trim() }));
          setName('');
        },
        onError: () => toast.error(t('error')),
      },
    );
  };

  return (
    <SectionCard
      id="phone-team-new"
      variant="panel"
      title={t('manager.teams.new')}
      subtitle={t('manager.teams.newHint')}
    >
      <form
        aria-label={t('manager.teams.new')}
        className="flex flex-wrap items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="min-w-56 flex-1">
          <TextField
            id="new-team-name"
            label={t('manager.teams.name')}
            value={name}
            maxLength={40}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
            error={error}
          />
        </div>
        <Button type="submit" variant="outline" className="mt-7" disabled={save.isPending}>
          {t('manager.teams.add')}
        </Button>
      </form>
    </SectionCard>
  );
}
