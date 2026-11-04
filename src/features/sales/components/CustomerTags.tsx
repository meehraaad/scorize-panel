import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TogglePill } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { TagList } from '@/components/ui/Tags';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  MAX_TAGS_PER_CUSTOMER,
  tagKey,
  tagsOf,
  tagsQuery,
  useCustomerTags,
  type CustomerData,
  type CustomerTag,
} from '../api';

/** The customer's tags on their card (S49): remove one with its ×, add from the team's list. */
export function CustomerTags({ customer }: { customer: CustomerData }) {
  const { t } = useTranslation('sales');
  const { data: list } = useQuery(tagsQuery);
  const save = useCustomerTags(customer.id);
  const [picking, setPicking] = useState(false);
  const tags = tagsOf(customer.tags, list);
  const byName = new Map(tags.map((tag) => [tag.name, tag]));

  const change = (ids: number[]) =>
    save.mutate(ids, { onError: () => toast.error(t('tags.saveError')) });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.length > 0 && (
        <TagList
          label={t('tags.label')}
          tags={tags.map((tag) => tag.name)}
          toneOf={(name) => byName.get(name)?.tone ?? 'neutral'}
          latin={false}
          removeLabel={(name) => t('tags.remove', { name })}
          onRemove={(name) => change(customer.tags.filter((id) => id !== byName.get(name)?.id))}
        />
      )}
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-on-hero-2 shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-raised hover:text-on-hero"
      >
        <Icon name="plus" size={16} />
        {tags.length ? t('tags.edit') : t('tags.add')}
      </button>
      <TagPicker
        open={picking}
        onClose={() => setPicking(false)}
        list={list ?? []}
        chosen={customer.tags}
        onChange={change}
      />
    </div>
  );
}

/** The team's tags as pills: each tap saves at once. A search finds a tag however it's typed. */
function TagPicker({
  open,
  onClose,
  list,
  chosen,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  list: readonly CustomerTag[];
  chosen: readonly number[];
  onChange: (ids: number[]) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [search, setSearch] = useState('');
  const key = tagKey(search);
  // Archived tags show only while the customer still carries them.
  const shown = list.filter(
    (tag) => (tag.active || chosen.includes(tag.id)) && tagKey(tag.name).includes(key),
  );
  const full = chosen.length >= MAX_TAGS_PER_CUSTOMER;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('tags.pickTitle')}
      subtitle={t('tags.pickSubtitle', {
        n: f.number(chosen.length),
        max: f.number(MAX_TAGS_PER_CUSTOMER),
      })}
      closeLabel={t('close')}
      footer={
        <Button className="w-full" onClick={onClose}>
          {t('tags.done')}
        </Button>
      }
    >
      <SearchField
        label={t('tags.search')}
        placeholder={t('tags.searchPlaceholder')}
        value={search}
        onChange={setSearch}
        className="w-full"
      />
      {shown.length > 0 ? (
        <div role="group" aria-label={t('tags.label')} className="flex flex-wrap gap-2">
          {shown.map((tag) => {
            const on = chosen.includes(tag.id);
            return (
              <TogglePill
                key={tag.id}
                label={tag.name}
                checked={on}
                disabled={!on && (full || !tag.active)}
                onChange={(checked) =>
                  onChange(checked ? [...chosen, tag.id] : chosen.filter((id) => id !== tag.id))
                }
              />
            );
          })}
        </div>
      ) : (
        <p className="m-0 text-sm leading-6 text-text-2">
          {list.length ? t('tags.noMatch') : t('tags.noneYet')}
        </p>
      )}
      <p className="m-0 text-[13px] leading-6 text-text-2">
        {full ? t('tags.full', { max: f.number(MAX_TAGS_PER_CUSTOMER) }) : t('tags.managerHint')}
      </p>
    </Dialog>
  );
}
