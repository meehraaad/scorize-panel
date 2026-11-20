import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LeadImportDialog } from '@/components/leads/LeadImportDialog';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import type { LeadSourceRow, SystemSource } from '@/lib/leads/api';
import { toast } from '@/lib/toast';
import {
  LEADS_IMPORT_API,
  SOURCES_KEY,
  sourcesQuery,
  useAddSource,
  useDeleteSource,
  useEditSource,
} from './sourcesApi';

/** The name error Django sends (`{name: ['…']}`), or null. */
const nameErrorOf = (error: unknown) =>
  error instanceof ApiError && error.status === 400
    ? ((error.body as { name?: string[] } | null)?.name?.[0] ?? null)
    : null;

/** Leads after an upload change the sales pages and this list's counts. */
const REFRESH = [SOURCES_KEY, ['sales']] as const;

/**
 * Leads: the team's lead sources (the system's are fixed; the team adds, renames, archives and
 * deletes its own) and adding leads from a CSV, as the sales manager does. Uploaded leads go to
 * the sales team's queue with the source picked here.
 */
export default function LeadsPage() {
  const { t } = useTranslation('marketing');
  const { data } = useSuspenseQuery(sourcesQuery);
  const [importing, setImporting] = useState(false);
  const own = data.filter((source) => !source.system);
  const system = data.filter((source) => source.system);

  return (
    <PageStack>
      <PageHeader
        title={t('leads.title')}
        subtitle={t('leads.subtitle')}
        actions={<Button onClick={() => setImporting(true)}>{t('leads.import')}</Button>}
      />
      <LeadImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        base={LEADS_IMPORT_API}
        sources={data}
        refresh={REFRESH}
      />
      <NewSource />
      <SectionCard
        id="own-sources"
        variant="panel"
        title={t('leads.own')}
        subtitle={t('leads.ownHint')}
      >
        {own.length === 0 ? (
          <p className="m-0 text-sm leading-7 text-text-2">{t('leads.empty')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {own.map((source) => (
              <SourceRow key={source.code} source={source} />
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard
        id="system-sources"
        variant="panel"
        title={t('leads.system')}
        subtitle={t('leads.systemHint')}
      >
        <ul className="m-0 flex list-none flex-col p-0">
          {system.map((source) => (
            <SystemRow key={source.code} source={source} />
          ))}
        </ul>
      </SectionCard>
    </PageStack>
  );
}

function NewSource() {
  const { t } = useTranslation('marketing');
  const add = useAddSource();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!name.trim()) return;
    add.mutate(name.trim(), {
      onSuccess: () => {
        setName('');
        setError(null);
        toast.success(t('leads.added'));
      },
      onError: (failure) => setError(nameErrorOf(failure) ?? t('card.error')),
    });
  };
  return (
    <SectionCard id="new-source" variant="panel" title={t('leads.new')}>
      <form
        className="flex flex-wrap items-start gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          className="min-w-0 flex-[1_1_240px]"
          label={t('leads.name')}
          hideLabel
          placeholder={t('leads.namePlaceholder')}
          value={name}
          maxLength={40}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          error={error ?? undefined}
        />
        <Button type="submit" disabled={!name.trim() || add.isPending}>
          {t('leads.add')}
        </Button>
      </form>
    </SectionCard>
  );
}

function SystemRow({ source }: { source: LeadSourceRow }) {
  const { t } = useTranslation('marketing');
  const { t: tl } = useTranslation('leads');
  const f = useFormat();
  return (
    <li className="flex min-h-12 flex-wrap items-center justify-between gap-3 py-2 not-first:shadow-[inset_0_1px_0_var(--hair)]">
      <span className="flex items-center gap-2">
        <span className="text-[15px] font-semibold">
          {tl(`source.${source.code as SystemSource}`, { defaultValue: source.name })}
        </span>
        <Chip tone="neutral" small>
          {t('leads.locked')}
        </Chip>
      </span>
      <span className="text-[13px] text-text-2">
        {t('leads.count', { n: f.number(source.leads ?? 0) })}
      </span>
    </li>
  );
}

function SourceRow({ source }: { source: LeadSourceRow }) {
  const { t } = useTranslation('marketing');
  const f = useFormat();
  const edit = useEditSource();
  const remove = useDeleteSource();
  const [name, setName] = useState(source.name);
  const [error, setError] = useState<string | null>(null);
  const id = source.id ?? 0;
  const used = (source.leads ?? 0) > 0;

  const change = (body: { name?: string; active?: boolean }) =>
    edit.mutate(
      { id, ...body },
      {
        onSuccess: () => {
          setError(null);
          toast.success(t('leads.saved'));
        },
        onError: (failure) => {
          const message = nameErrorOf(failure);
          if (message) setError(message);
          else toast.error(t('card.error'));
        },
      },
    );
  const rename = () => {
    const next = name.trim().split(/\s+/).join(' ');
    if (!next) setName(source.name);
    else if (next !== source.name) change({ name: next });
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">{source.name}</span>
          {!source.active && (
            <Chip tone="neutral" small>
              {t('leads.archived')}
            </Chip>
          )}
        </span>
        <span className="text-[13px] text-text-2">
          {t('leads.count', { n: f.number(source.leads ?? 0) })}
        </span>
      </div>
      <div className="flex flex-wrap items-start gap-2.5">
        <TextField
          className="min-w-0 flex-[1_1_200px]"
          label={t('leads.name')}
          hideLabel
          value={name}
          maxLength={40}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') rename();
          }}
          error={error ?? undefined}
        />
        <IconButton
          icon="trash"
          tone="danger"
          aria-label={t(used ? 'leads.archive' : 'leads.delete', { name: source.name })}
          disabled={remove.isPending || (used && !source.active)}
          onClick={() =>
            remove.mutate(id, {
              onSuccess: (result) =>
                toast.success(t(result ? 'leads.archivedDone' : 'leads.deleted')),
              onError: () => toast.error(t('card.error')),
            })
          }
        />
      </div>
      <Switch
        label={t('leads.active')}
        description={t(source.active ? 'leads.activeHint' : 'leads.archivedHint')}
        checked={source.active}
        disabled={edit.isPending}
        onChange={(active) => change({ active })}
      />
    </li>
  );
}
