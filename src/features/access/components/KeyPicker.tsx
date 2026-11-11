import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchField } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import type { AccessKey, KeyArea } from '../api';

/**
 * Keys to tick, by area, with a search (name, meaning or code). `locked`: keys already held some
 * other way (a group), shown ticked and named, not changeable here. A selected key the list doesn't
 * name (one of Django admin's own) still shows, under its code, so it can be taken back.
 */
export function KeyPicker({
  label,
  areas,
  keys,
  selected,
  onChange,
  locked,
}: {
  label: string;
  areas: readonly KeyArea[];
  keys: readonly AccessKey[];
  selected: ReadonlySet<string>;
  onChange: (selected: Set<string>) => void;
  /** key → why it's held already ("گروه مدیر فروش"). */
  locked?: ReadonlyMap<string, string>;
}) {
  const { t } = useTranslation('access');
  const [search, setSearch] = useState('');
  const known = new Set(keys.map((key) => key.id));
  const extra: AccessKey[] = [...selected, ...(locked?.keys() ?? [])]
    .filter((id, index, all) => !known.has(id) && all.indexOf(id) === index)
    .map((id) => ({ id, area: 'admin', label: id, about: '', name: id, holders: 0, groups: [] }));
  const term = search.trim().toLowerCase();
  const shown = [...keys, ...extra].filter(
    (key) =>
      !term ||
      key.label.toLowerCase().includes(term) ||
      key.about.toLowerCase().includes(term) ||
      key.id.toLowerCase().includes(term),
  );
  const areaList = [
    ...areas,
    ...(extra.length && !areas.some((area) => area.id === 'admin')
      ? [{ id: 'admin', label: t('keys.adminArea') }]
      : []),
  ];

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  };

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="mb-3 p-0 text-base font-bold">{label}</legend>
      <SearchField
        label={t('keys.search')}
        placeholder={t('keys.searchPlaceholder')}
        value={search}
        onChange={setSearch}
        className="flex-none"
      />
      {shown.length === 0 && <p className="m-0 text-sm text-text-2">{t('keys.noMatch')}</p>}
      {areaList.map((area) => {
        const rows = shown.filter((key) => key.area === area.id);
        if (rows.length === 0) return null;
        return (
          <section key={area.id} aria-label={area.label} className="flex flex-col">
            <h4 className="m-0 py-1 text-[13px] font-semibold text-text-2">{area.label}</h4>
            {rows.map((key) => (
              <KeyRow
                key={key.id}
                accessKey={key}
                checked={selected.has(key.id) || Boolean(locked?.has(key.id))}
                lockedBy={selected.has(key.id) ? undefined : locked?.get(key.id)}
                onChange={(on) => toggle(key.id, on)}
              />
            ))}
          </section>
        );
      })}
    </fieldset>
  );
}

function KeyRow({
  accessKey,
  checked,
  lockedBy,
  onChange,
}: {
  accessKey: AccessKey;
  checked: boolean;
  lockedBy: string | undefined;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex min-h-12 items-start gap-3 rounded-2xl px-2 py-2 ${
        lockedBy ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-canvas'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={Boolean(lockedBy)}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-5 flex-none accent-primary"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-medium">{accessKey.label}</span>
        {accessKey.about && (
          <span className="text-[13px] leading-6 text-text-2">{accessKey.about}</span>
        )}
        {lockedBy && (
          <span className="flex items-center gap-1 text-[13px] text-text-2">
            <Icon name="lock" size={14} />
            {lockedBy}
          </span>
        )}
      </span>
    </label>
  );
}
