import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TagList } from '@/components/ui/Tags';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  TAG_TONES,
  managerTagsQuery,
  tagKey,
  useDeleteTag,
  useSaveTag,
  type ManagerTag,
} from '../api';

/** The name error Django sends (`{name: ['…']}`), or null. */
const nameErrorOf = (error: unknown) =>
  error instanceof ApiError && error.status === 400
    ? ((error.body as { name?: string[] } | null)?.name?.[0] ?? null)
    : null;

/**
 * The team's customer tags (S49): the manager adds, renames, recolors and archives them; sellers
 * pick from this list. A name typed another way (ی/ک, half-space) is refused as already there.
 */
export default function TagsPage() {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(managerTagsQuery);
  const save = useSaveTag();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Same as Django: a tag that only differs by ی/ک, spaces or a half-space is already there.
  const same = tagKey(name) ? data.find((tag) => tagKey(tag.name) === tagKey(name)) : undefined;

  const add = () => {
    if (!tagKey(name) || same) return;
    save.mutate(
      { name },
      {
        onSuccess: () => {
          setName('');
          setError(null);
          toast.success(t('manager.tags.added'));
        },
        onError: (failure) => setError(nameErrorOf(failure) ?? t('error')),
      },
    );
  };

  return (
    <>
      <PageHeader title={t('manager.tags.title')} subtitle={t('manager.tags.subtitle')} />
      <SectionCard id="new-tag" variant="panel" title={t('manager.tags.new')}>
        <form
          className="flex flex-wrap items-start gap-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <TextField
            className="min-w-0 flex-[1_1_240px]"
            label={t('manager.tags.name')}
            hideLabel
            placeholder={t('manager.tags.namePlaceholder')}
            value={name}
            maxLength={32}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            error={same ? t('manager.tags.exists', { name: same.name }) : (error ?? undefined)}
          />
          <Button type="submit" disabled={!tagKey(name) || !!same || save.isPending}>
            {t('manager.tags.add')}
          </Button>
        </form>
      </SectionCard>
      <SectionCard id="tags-list" variant="panel" title={t('manager.tags.list')}>
        {data.length === 0 ? (
          <EmptyState>{t('manager.tags.empty')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {data.map((tag) => (
              <TagRow key={tag.id} tag={tag} />
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function TagRow({ tag }: { tag: ManagerTag }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSaveTag();
  const remove = useDeleteTag();
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);

  const change = (body: Parameters<typeof save.mutate>[0]) =>
    save.mutate(body, {
      onSuccess: () => {
        setError(null);
        toast.success(t('manager.tags.saved'));
      },
      onError: (failure) => {
        const message = nameErrorOf(failure);
        if (message) setError(message);
        else toast.error(t('error'));
      },
    });

  const rename = () => {
    const next = name.trim().split(/\s+/).join(' ');
    if (!tagKey(next)) setName(tag.name);
    else if (next !== tag.name) change({ id: tag.id, name: next });
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TagList
          label={t('manager.tags.preview')}
          tags={[tag.name]}
          tone={tag.tone}
          latin={false}
        />
        <span className="text-[13px] text-text-2">
          {t('manager.tags.customers', { n: f.number(tag.customers) })}
        </span>
      </div>
      <div className="flex flex-wrap items-start gap-2.5">
        <TextField
          className="min-w-0 flex-[1_1_200px]"
          label={t('manager.tags.name')}
          hideLabel
          value={name}
          maxLength={32}
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
        <SelectField
          inline
          label={t('manager.tags.tone')}
          value={tag.tone}
          onChange={(tone) => change({ id: tag.id, tone })}
          options={TAG_TONES.map((tone) => ({
            value: tone,
            label: t(`manager.tags.toneName.${tone}`),
          }))}
        />
        {tag.customers === 0 && (
          <IconButton
            icon="trash"
            tone="danger"
            aria-label={t('manager.tags.delete', { name: tag.name })}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(tag.id, {
                onSuccess: () => toast.success(t('manager.tags.deleted')),
                onError: () => toast.error(t('error')),
              })
            }
          />
        )}
      </div>
      <Switch
        label={t('manager.tags.active')}
        description={t(tag.active ? 'manager.tags.activeHint' : 'manager.tags.archivedHint')}
        checked={tag.active}
        disabled={save.isPending}
        onChange={(active) => change({ id: tag.id, active })}
      />
    </li>
  );
}
