import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  scopesQuery,
  useAddScope,
  useRemoveScope,
  useScopesFromCountries,
  type Scope,
  type ScopesData,
} from './api';
import { casePath } from './paths';

/** The select's value for "every kind" / "every country". */
const EVERY = '';

/**
 * Supervisors and their scopes (SVC5), for managers. Until Django applies the scopes, they only
 * show where they and today's rule disagree; the list must be empty before they are switched on.
 */
export default function ScopesPage() {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const { data } = useSuspenseQuery(scopesQuery);
  return (
    <PageStack>
      <PageHeader
        title={t('scopes.title')}
        subtitle={t('scopes.subtitle', { n: f.number(data.scopes.length) })}
      />
      <Notice tone={data.applied ? 'success' : 'info'}>
        {t(data.applied ? 'scopes.applied' : 'scopes.shadow')}
      </Notice>
      <Differences data={data} />
      <People data={data} />
      <AddScope data={data} />
    </PageStack>
  );
}

function scopeLabel(scope: Scope, every: { kind: string; country: string }) {
  return `${scope.kind?.name ?? every.kind} · ${scope.country?.name ?? every.country}`;
}

function Differences({ data }: { data: ScopesData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const fromCountries = useScopesFromCountries();
  const { count, results } = data.differences;
  return (
    <SectionCard
      id="scope-differences"
      title={t('scopes.differences.title')}
      end={
        <span className={`text-sm font-medium ${count ? 'text-warn' : 'text-good'}`}>
          {count
            ? t('scopes.differences.count', { n: f.number(count) })
            : t('scopes.differences.none')}
        </span>
      }
    >
      {results.length > 0 && (
        <ul className="m-0 list-none p-0">
          {results.map((row) => (
            <li
              key={`${String(row.staff)}-${String(row.case)}`}
              className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="flex-[1_1_140px] text-[15px] font-medium">{row.staff_name}</span>
              <Link
                to={casePath(row.case)}
                className="inline-flex min-h-11 flex-[1_1_160px] items-center text-primary-text hover:underline"
              >
                {row.case_name}
              </Link>
              <span className="flex-[1_1_200px] text-sm text-text-2">
                {t(`scopes.differences.${row.side}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 lg:px-8">
        <Button
          variant="outline"
          disabled={fromCountries.isPending}
          onClick={() =>
            fromCountries.mutate(undefined, {
              onSuccess: ({ made }) =>
                toast.success(t('scopes.fromCountries.done', { n: f.number(made) })),
              onError: () => toast.error(t('saveError')),
            })
          }
        >
          {t('scopes.fromCountries.button')}
        </Button>
        <span className="text-sm leading-6 text-text-2">{t('scopes.fromCountries.hint')}</span>
      </div>
    </SectionCard>
  );
}

function People({ data }: { data: ScopesData }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const remove = useRemoveScope();
  const every = { kind: t('scopes.everyKind'), country: t('scopes.everyCountry') };
  const withScopes = data.people.filter((person) =>
    data.scopes.some((scope) => scope.staff === person.id),
  );
  return (
    <SectionCard id="scope-people" title={t('scopes.people.title')}>
      {withScopes.length === 0 ? (
        <EmptyState>{t('scopes.people.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none p-0 pb-2">
          {withScopes.map((person) => (
            <li
              key={person.id}
              className="flex flex-col gap-2 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8"
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-[15px] font-semibold">{person.name}</span>
                {person.countries.length > 0 && (
                  <span className="text-[13px] text-text-2">
                    {t('scopes.people.today', { countries: f.list(person.countries) })}
                  </span>
                )}
              </span>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {data.scopes
                  .filter((scope) => scope.staff === person.id)
                  .map((scope) => {
                    const label = scopeLabel(scope, every);
                    return (
                      <li
                        key={scope.id}
                        className="flex items-center gap-1 rounded-full bg-canvas ps-3.5 text-sm"
                      >
                        {label}
                        <Button
                          variant="danger"
                          className="h-11 px-3 text-sm"
                          aria-label={t('scopes.people.remove', {
                            name: person.name,
                            scope: label,
                          })}
                          disabled={remove.isPending}
                          onClick={() =>
                            remove.mutate(scope.id, {
                              onSuccess: () =>
                                toast.success(
                                  t('scopes.people.removed', { name: person.name, scope: label }),
                                ),
                              onError: () => toast.error(t('saveError')),
                            })
                          }
                        >
                          {t('scopes.people.removeShort')}
                        </Button>
                      </li>
                    );
                  })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function AddScope({ data }: { data: ScopesData }) {
  const { t } = useTranslation('supervisor');
  const add = useAddScope();
  const [staff, setStaff] = useState(String(data.people[0]?.id ?? ''));
  const [kind, setKind] = useState(EVERY);
  const [country, setCountry] = useState(EVERY);
  const person = data.people.find((entry) => String(entry.id) === staff);

  const submit = () => {
    if (!person) return;
    add.mutate(
      { staff: person.id, kind: kind || null, country: country ? Number(country) : null },
      {
        onSuccess: (scope) =>
          toast.success(
            t('scopes.add.done', {
              name: person.name,
              scope: scopeLabel(scope, {
                kind: t('scopes.everyKind'),
                country: t('scopes.everyCountry'),
              }),
            }),
          ),
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('scopes.add.exists')
              : t('saveError'),
          ),
      },
    );
  };

  return (
    <SectionCard id="scope-add" title={t('scopes.add.title')}>
      <div className="flex flex-col gap-4 px-5 pt-2 pb-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label={t('scopes.add.staff')}
            value={staff}
            onChange={setStaff}
            options={data.people.map((entry) => ({ value: String(entry.id), label: entry.name }))}
          />
          <SelectField
            label={t('scopes.add.kind')}
            value={kind}
            onChange={setKind}
            options={[
              { value: EVERY, label: t('scopes.everyKind') },
              ...data.kinds.map((entry) => ({ value: entry.key, label: entry.name })),
            ]}
          />
          <SelectField
            label={t('scopes.add.country')}
            value={country}
            onChange={setCountry}
            options={[
              { value: EVERY, label: t('scopes.everyCountry') },
              ...data.countries.map((entry) => ({ value: String(entry.id), label: entry.name })),
            ]}
          />
        </div>
        <div>
          <Button disabled={!person || add.isPending} onClick={submit}>
            {t('scopes.add.save')}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
