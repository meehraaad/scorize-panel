import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  phoneMenusQuery,
  useSavePhoneMenu,
  type MenuKey,
  type MenuKeyKind,
  type PhoneMenu,
  type PhoneMenus,
} from '@/lib/sales/phoneCalls';
import { toLatinNumber } from '@/lib/text';
import { toast } from '@/lib/toast';

const KINDS = [
  'team',
  'extension',
  'direct',
  'message',
  'menu',
  'hangup',
] as const satisfies readonly MenuKeyKind[];
const KEY = /^(\d{1,4}|\*|#)$/;
/** The PBX's menu names this office uses, with a label of their own. */
const KNOWN = [
  'ivr-main',
  'ivr-outtime',
  'Holidays',
  'ivr-poshtibani',
  'ivr-poshtibani-gharardadha',
  'ivr-hamkari',
] as const;
const isKnown = (name: string): name is (typeof KNOWN)[number] =>
  (KNOWN as readonly string[]).includes(name);
const MESSAGES = ['feedbacks', 'peyghamgir'] as const;
const isMessage = (name: string): name is (typeof MESSAGES)[number] =>
  (MESSAGES as readonly string[]).includes(name);

type Options = PhoneMenus['options'];
interface Row extends MenuKey {
  /** Stable while editing (the key itself can change). */
  rowId: number;
}

function useMenuName() {
  const { t } = useTranslation('sales');
  return (name: string) => (isKnown(name) ? t(`manager.menus.known.${name}`) : name);
}

/**
 * What each key of the office line's menus does (manager section): main menu, after hours,
 * holidays and the others the PBX has. A key can go to a team, a person (any time, or only in the
 * direct-number hours), a message box, another menu, or hang up.
 */
export default function PhoneMenusPage() {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useSuspenseQuery(phoneMenusQuery);

  return (
    <>
      <PageHeader
        title={t('manager.menus.title')}
        subtitle={
          data.seen_at
            ? t('manager.teams.seen', { time: f.dateTime(data.seen_at) })
            : t('manager.teams.notSeen')
        }
      />
      {data.menus.length === 0 ? (
        <SectionCard id="phone-menus-empty" variant="panel" title={t('manager.menus.title')}>
          <EmptyState>{t('manager.menus.empty')}</EmptyState>
        </SectionCard>
      ) : (
        data.menus.map((menu) => <MenuCard key={menu.id} menu={menu} options={data.options} />)
      )}
    </>
  );
}

/** A target a kind starts with: the first option it has. */
function firstTarget(kind: MenuKeyKind, options: Options, menuId: string) {
  if (kind === 'team') return options.teams[0]?.number ?? '';
  if (kind === 'menu') return options.menus.find((menu) => menu.id !== menuId)?.id ?? '';
  if (kind === 'message') return options.messages[0] ?? '';
  if (kind === 'extension') {
    const person = options.people[0];
    return person?.desk ?? person?.mobile ?? '';
  }
  if (kind === 'direct') return options.directs[0] ?? '';
  return '';
}

function MenuCard({ menu, options }: { menu: PhoneMenu; options: Options }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const menuName = useMenuName();
  const save = useSavePhoneMenu();
  const next = useRef(menu.keys.length);
  const [rows, setRows] = useState<Row[]>(() =>
    menu.keys.map((key, index) => ({ ...key, rowId: index })),
  );
  const [tried, setTried] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.key, (counts.get(row.key) ?? 0) + 1);
  const keyError = (row: Row) => {
    if (!KEY.test(row.key)) return t('manager.menus.keyHint');
    if ((counts.get(row.key) ?? 0) > 1) return t('manager.menus.keyTwice');
    return undefined;
  };
  const targetError = (row: Row) =>
    row.kind !== 'hangup' && row.target === '' ? t('manager.menus.targetHint') : undefined;

  const set = (rowId: number, change: Partial<Row>) =>
    setRows((list) => list.map((row) => (row.rowId === rowId ? { ...row, ...change } : row)));

  const submit = () => {
    setTried(true);
    if (rows.some((row) => keyError(row) ?? targetError(row))) {
      setAttempt((n) => n + 1);
      return;
    }
    save.mutate(
      { id: menu.id, keys: rows.map(({ key, kind, target }) => ({ key, kind, target })) },
      {
        onSuccess: () => {
          setTried(false);
          toast.success(t('manager.menus.saved', { name: menuName(menu.name) }));
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 400
              ? t('manager.menus.refused')
              : t('error'),
          ),
      },
    );
  };

  const name = menuName(menu.name);
  return (
    <SectionCard
      id={`phone-menu-${menu.id}`}
      variant="panel"
      title={name}
      subtitle={menu.saved ? undefined : t('manager.menus.fromPbx')}
    >
      <form
        ref={form}
        aria-label={t('manager.menus.formLabel', { name })}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {rows.length === 0 ? (
          <p className="m-0 text-[15px] text-text-2">{t('manager.menus.noKeys')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((row) => (
              <li
                key={row.rowId}
                className="flex flex-col gap-2 border-b border-line-2 py-3 last:border-b-0 sm:flex-row sm:items-start"
              >
                <div className="sm:w-28">
                  <TextField
                    label={t('manager.menus.key')}
                    value={f.digits(row.key)}
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) =>
                      set(row.rowId, { key: toLatinNumber(event.target.value).trim() })
                    }
                    error={tried ? keyError(row) : undefined}
                  />
                </div>
                <div className="min-w-40 flex-1">
                  <SelectField
                    label={t('manager.menus.kindLabel', { key: f.digits(row.key) })}
                    options={[...(row.kind === 'other' ? (['other'] as const) : []), ...KINDS].map(
                      (kind) => ({ value: kind, label: t(`manager.menus.kind.${kind}`) }),
                    )}
                    value={row.kind}
                    onChange={(kind) =>
                      set(row.rowId, { kind, target: firstTarget(kind, options, menu.id) })
                    }
                  />
                </div>
                <div className="min-w-48 flex-[2]">
                  <TargetField
                    row={row}
                    menuId={menu.id}
                    options={options}
                    onChange={(target) => set(row.rowId, { target })}
                    error={tried ? targetError(row) : undefined}
                  />
                </div>
                <IconButton
                  icon="trash"
                  tone="danger"
                  className="sm:mt-7"
                  aria-label={t('manager.menus.remove', { key: f.digits(row.key) })}
                  onClick={() => setRows((list) => list.filter((item) => item.rowId !== row.rowId))}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const rowId = next.current++;
              setRows((list) => [
                ...list,
                { rowId, key: '', kind: 'team', target: firstTarget('team', options, menu.id) },
              ]);
            }}
          >
            {t('manager.menus.addKey')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {t('manager.menus.save')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function TargetField({
  row,
  menuId,
  options,
  onChange,
  error,
}: {
  row: Row;
  menuId: string;
  options: Options;
  onChange: (target: string) => void;
  error: string | undefined;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const menuName = useMenuName();
  const label = t('manager.menus.targetLabel', { key: f.digits(row.key) });
  const personOf = (ext: string) =>
    options.people.find((person) => person.desk === ext || person.mobile === ext);

  if (row.kind === 'hangup') return null;
  if (row.kind === 'other')
    return (
      <p className="m-0 pt-2 text-[13px] text-text-2 sm:pt-9">{t('manager.menus.otherKept')}</p>
    );

  let choices: { value: string; label: string }[] = [];
  if (row.kind === 'team')
    choices = options.teams.map((team) => ({
      value: team.number,
      label: `${team.name} · ${f.digits(team.number)}`,
    }));
  if (row.kind === 'menu')
    choices = options.menus
      .filter((menu) => menu.id !== menuId)
      .map((menu) => ({ value: menu.id, label: menuName(menu.name) }));
  if (row.kind === 'message')
    choices = options.messages.map((name) => ({
      value: name,
      label: isMessage(name) ? t(`manager.menus.message.${name}`) : name,
    }));
  if (row.kind === 'extension')
    choices = options.people.flatMap((person) => {
      const ext = person.desk ?? person.mobile;
      return ext ? [{ value: ext, label: `${person.name} · ${f.digits(ext)}` }] : [];
    });
  if (row.kind === 'direct')
    choices = options.directs.map((ext) => ({
      value: ext,
      label: personOf(ext)
        ? `${personOf(ext)?.name ?? ''} · ${f.digits(ext)}`
        : t('manager.menus.extension', { ext: f.digits(ext) }),
    }));
  // A key can point at something no longer offered (an extension that is no one's): keep it shown.
  if (row.target && !choices.some((choice) => choice.value === row.target))
    choices = [
      { value: row.target, label: t('manager.menus.extension', { ext: f.digits(row.target) }) },
      ...choices,
    ];
  if (choices.length === 0)
    return <p className="m-0 pt-2 text-[13px] text-danger sm:pt-9">{t('manager.menus.none')}</p>;
  return (
    <SelectField
      label={label}
      options={choices}
      value={row.target}
      onChange={onChange}
      error={error}
    />
  );
}
