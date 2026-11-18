import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineConfirm } from '@/components/ui/InlineConfirm';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  phoneExtensionsQuery,
  useSetStaffDesk,
  useSetStaffMobile,
  type PhoneExtensions,
  type StaffPhone,
} from '@/lib/sales/phoneCalls';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';

const EXTENSION = /^[1-9]\d{2}$/;

/**
 * Who has which phone (manager > phone > extensions): each active staff member's desk phone (the
 * one a seller sets in settings), mobile extension and teams. A phone manager links or unlinks a
 * desk phone and makes or removes a mobile extension for anyone; extensions in a team that are no
 * one's are listed apart.
 */
export default function PhoneExtensionsPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(phoneExtensionsQuery);
  const [search, setSearch] = useState('');
  const query = toLatinDigits(search).trim().toLowerCase();
  const people = query
    ? data.people.filter(
        (person) =>
          person.name.toLowerCase().includes(query) ||
          person.desk?.includes(query) ||
          person.mobile?.number?.includes(query),
      )
    : data.people;
  const linked = data.people.filter((person) => person.desk || person.mobile).length;

  return (
    <>
      <PageHeader
        title={t('manager.extensions.title')}
        subtitle={t('manager.extensions.subtitle', {
          linked: f.number(linked),
          all: f.number(data.people.length),
        })}
      />
      {data.unlinked.length > 0 && <Unlinked data={data} />}
      <SectionCard
        id="phone-extensions"
        title={t('manager.extensions.people')}
        end={
          <div className="w-full sm:w-72">
            <TextField
              label={t('manager.extensions.search')}
              type="search"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        }
      >
        {people.length === 0 ? (
          <div className="px-5 pb-6 lg:px-8">
            <EmptyState>{t('manager.extensions.none')}</EmptyState>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0 pb-3">
            {people.map((person) => (
              <PersonRow key={person.id} person={person} mobileOn={data.mobile_available} />
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

/** Extensions a PBX team rings that belong to no one: link them from a person's row. */
function Unlinked({ data }: { data: PhoneExtensions }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  return (
    <SectionCard
      id="phone-extensions-unlinked"
      variant="panel"
      title={t('manager.extensions.unlinked')}
      subtitle={t('manager.extensions.unlinkedHint')}
    >
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {data.unlinked.map((row) => (
          <li key={row.extension}>
            <Chip tone="danger">
              {t('manager.extensions.unlinkedRow', {
                extension: f.digits(row.extension),
                teams: row.teams.map((team) => team.name || f.digits(team.number)).join('، '),
              })}
            </Chip>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function PersonRow({ person, mobileOn }: { person: StaffPhone; mobileOn: boolean }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  return (
    <li className="flex flex-col gap-3 border-t border-hair px-5 py-4 first:border-t-0 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={person.name} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-bold">{person.name}</span>
          {person.changed && (
            <span className="text-[13px] text-text-2">
              {t('manager.extensions.changed', {
                by: person.changed.by ?? t('manager.extensions.someone'),
                time: f.dateTime(person.changed.at),
              })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {person.teams.map((team) => (
            <Chip key={team.number} tone="primary" small>
              {team.name || t('manager.teams.untitled', { number: f.digits(team.number) })}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DeskCell person={person} />
        <MobileCell person={person} on={mobileOn} />
      </div>
    </li>
  );
}

/** The desk phone: shown with a change button, or an inline form to set it. */
function DeskCell({ person }: { person: StaffPhone }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSetStaffDesk();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(person.desk ?? '');
  const digits = toLatinDigits(draft).trim();
  const invalid = digits !== '' && !EXTENSION.test(digits);
  const taken = save.error instanceof ApiError && save.error.status === 409;

  const submit = (desk: string | null) =>
    save.mutate(
      { id: person.id, desk },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success(
            desk
              ? t('manager.extensions.deskSaved', { name: person.name, extension: f.digits(desk) })
              : t('manager.extensions.deskCleared', { name: person.name }),
          );
        },
        onError: (error) => {
          if (!(error instanceof ApiError && error.status === 409))
            toast.error(t('manager.extensions.error'));
        },
      },
    );
  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!invalid) submit(digits || null);
  };

  if (editing)
    return (
      <form onSubmit={onSubmit} className="m-0 flex flex-col gap-2">
        <TextField
          label={t('manager.extensions.desk')}
          hint={t('manager.extensions.deskHint')}
          error={
            invalid
              ? t('officeExtension.invalid')
              : taken
                ? t('manager.extensions.taken')
                : undefined
          }
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          value={draft}
          onChange={(event) => {
            save.reset();
            setDraft(event.target.value);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={invalid || save.isPending}>
            {t('manager.extensions.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              save.reset();
              setDraft(person.desk ?? '');
              setEditing(false);
            }}
          >
            {t('manager.extensions.cancel')}
          </Button>
          {person.desk && (
            <Button
              type="button"
              variant="danger"
              disabled={save.isPending}
              onClick={() => submit(null)}
            >
              {t('manager.extensions.unlink')}
            </Button>
          )}
        </div>
      </form>
    );

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-2.5">
      <div className="flex flex-col">
        <span className="text-[13px] text-text-2">{t('manager.extensions.desk')}</span>
        <span className="font-bold">
          {person.desk ? f.digits(person.desk) : t('manager.extensions.noDesk')}
        </span>
      </div>
      <Button
        variant="outline"
        className="h-11 px-4 text-sm"
        aria-label={t('manager.extensions.editDesk', { name: person.name })}
        onClick={() => {
          setDraft(person.desk ?? '');
          setEditing(true);
        }}
      >
        {person.desk ? t('manager.extensions.change') : t('manager.extensions.link')}
      </Button>
    </div>
  );
}

const MOBILE_TONE = {
  ready: 'good',
  pending: 'warn',
  failed: 'danger',
  removing: 'neutral',
} as const;

/** The mobile extension: its number and state, and make / remove. */
function MobileCell({ person, on }: { person: StaffPhone; on: boolean }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSetStaffMobile();
  const [confirming, setConfirming] = useState(false);
  const mobile = person.mobile;

  const run = (action: 'create' | 'remove') =>
    save.mutate(
      { id: person.id, action },
      {
        onSuccess: () => {
          setConfirming(false);
          toast.success(
            t(
              action === 'create'
                ? 'manager.extensions.mobileAsked'
                : 'manager.extensions.mobileRemoved',
              {
                name: person.name,
              },
            ),
          );
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('manager.extensions.mobileBusy')
              : t('manager.extensions.error'),
          ),
      },
    );

  if (confirming)
    return (
      <InlineConfirm
        message={t('manager.extensions.removeMobileAsk', { name: person.name })}
        confirmLabel={t('manager.extensions.removeMobile')}
        cancelLabel={t('manager.extensions.cancel')}
        pending={save.isPending}
        onConfirm={() => run('remove')}
        onCancel={() => setConfirming(false)}
      />
    );

  const canMake = on && (!mobile || mobile.status === 'failed');
  const canRemove = on && mobile && mobile.status !== 'removing';
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-2.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-text-2">{t('manager.extensions.mobile')}</span>
        {mobile ? (
          <span className="flex flex-wrap items-center gap-2">
            {mobile.number && <span className="font-bold">{f.digits(mobile.number)}</span>}
            <Chip tone={MOBILE_TONE[mobile.status]} small>
              {t(`manager.extensions.mobileStatus.${mobile.status}`)}
            </Chip>
          </span>
        ) : (
          <span className="font-bold">{t('manager.extensions.noMobile')}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {canMake && (
          <Button
            variant="outline"
            className="h-11 px-4 text-sm"
            disabled={save.isPending}
            aria-label={t('manager.extensions.makeMobileFor', { name: person.name })}
            onClick={() => run('create')}
          >
            {mobile ? t('manager.extensions.retryMobile') : t('manager.extensions.makeMobile')}
          </Button>
        )}
        {canRemove && mobile.status !== 'failed' && (
          <Button
            variant="danger"
            className="h-11 px-4 text-sm"
            aria-label={t('manager.extensions.removeMobileFor', { name: person.name })}
            onClick={() => setConfirming(true)}
          >
            {t('manager.extensions.removeMobile')}
          </Button>
        )}
      </div>
    </div>
  );
}
