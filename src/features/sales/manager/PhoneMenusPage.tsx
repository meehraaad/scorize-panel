import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PageColumns } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  phoneMenusQuery,
  phoneVoicesQuery,
  useSavePhoneMenu,
  type MenuKey,
  type MenuKeyKind,
  type PhoneMenu,
  type PhoneMenus,
} from '@/lib/sales/phoneCalls';
import { toLatinNumber } from '@/lib/text';
import { toast } from '@/lib/toast';
import { salesPath } from '../paths';
import { KeyBadge } from './KeyBadge';
import { repeatedKeys } from './phoneMap';
import { useKeyTarget, useMenuName } from './phoneNames';

const KINDS = [
  'team',
  'extension',
  'direct',
  'message',
  'menu',
  'hangup',
] as const satisfies readonly MenuKeyKind[];
const KEY = /^(\d{1,4}|\*|#)$/;
const MESSAGES = ['feedbacks', 'peyghamgir'] as const;
const isMessage = (name: string): name is (typeof MESSAGES)[number] =>
  (MESSAGES as readonly string[]).includes(name);

type Options = PhoneMenus['options'];
interface Row extends MenuKey {
  /** Stable while editing (the key itself can change). */
  rowId: number;
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
  const menuName = useMenuName();
  const [params] = useSearchParams();
  const picked = data.menus.find((menu) => menu.id === params.get('menu')) ?? data.menus[0];

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
        <>
          {data.menus.length > 1 && (
            <nav aria-label={t('manager.menus.pick')} className="flex flex-wrap gap-2">
              {data.menus.map((menu) => {
                const current = menu.id === picked?.id;
                return (
                  <Link
                    key={menu.id}
                    to={`${salesPath('manager/phone/menus')}?menu=${menu.id}`}
                    aria-current={current ? 'page' : undefined}
                    className={`flex min-h-12 flex-col justify-center rounded-2xl px-4 py-1.5 text-start ${
                      current
                        ? 'bg-hero text-on-hero'
                        : 'bg-surface text-text shadow-[inset_0_0_0_1px_var(--line-2)] hover:shadow-[inset_0_0_0_1px_var(--line-3)]'
                    }`}
                  >
                    <span className="text-sm font-semibold">{menuName(menu.name)}</span>
                    <span className={`text-xs ${current ? 'text-on-hero-2' : 'text-text-2'}`}>
                      {t('manager.menus.keyCount', {
                        count: menu.keys.length,
                        n: f.number(menu.keys.length),
                      })}
                      {!menu.saved && ` · ${t('manager.menus.fromVoip')}`}
                    </span>
                  </Link>
                );
              })}
            </nav>
          )}
          {picked && <MenuCard key={picked.id} menu={picked} options={data.options} />}
        </>
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
  const twice = repeatedKeys(rows);
  return (
    <PageColumns
      asideLabel={t('manager.menus.keypad.title')}
      main={
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
                    <span className="hidden sm:mt-8 sm:block">
                      <KeyBadge
                        value={row.key ? f.digits(row.key) : '?'}
                        tone={tried && keyError(row) ? 'danger' : 'primary'}
                      />
                    </span>
                    <div className="sm:w-24">
                      <TextField
                        label={t('manager.menus.key')}
                        value={f.digits(row.key)}
                        dir="ltr"
                        inputMode="numeric"
                        maxLength={4}
                        className="text-center text-lg font-bold"
                        onChange={(event) =>
                          set(row.rowId, { key: toLatinNumber(event.target.value).trim() })
                        }
                        error={tried ? keyError(row) : undefined}
                      />
                    </div>
                    <div className="min-w-40 flex-1">
                      <SelectField
                        label={t('manager.menus.kindLabel', { key: f.digits(row.key) })}
                        options={[
                          ...(row.kind === 'other' ? (['other'] as const) : []),
                          ...KINDS,
                        ].map((kind) => ({ value: kind, label: t(`manager.menus.kind.${kind}`) }))}
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
                      onClick={() =>
                        setRows((list) => list.filter((item) => item.rowId !== row.rowId))
                      }
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
      }
      aside={
        <>
          <Keypad rows={rows} twice={twice} options={options} />
          {ON_SERVER.phoneVoices && <Greeting menu={menu.name} />}
        </>
      }
    />
  );
}

type KeyState = 'twice' | 'used' | 'free';
const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

/** The phone's keypad with this menu's keys on it: taken (and where to), free, or used twice. */
function Keypad({
  rows,
  twice,
  options,
}: {
  rows: MenuKey[];
  twice: Set<string>;
  options: Options;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const target = useKeyTarget(options);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const long = rows.filter((row) => row.key && !PAD.includes(row.key));
  return (
    <SectionCard
      id="phone-menu-keypad"
      variant="panel"
      title={t('manager.menus.keypad.title')}
      subtitle={t('manager.menus.keypad.subtitle')}
    >
      <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
        {PAD.map((key) => {
          const row = byKey.get(key);
          const state: KeyState = twice.has(key) ? 'twice' : row ? 'used' : 'free';
          return (
            <li
              key={key}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-center ${
                state === 'twice'
                  ? 'bg-danger-tint text-danger'
                  : state === 'used'
                    ? 'bg-tint text-primary-text'
                    : 'text-text-3 shadow-[inset_0_0_0_1px_var(--line-2)]'
              }`}
            >
              <span className="text-lg font-bold">{f.digits(key)}</span>
              <span className="w-full truncate text-[11px] leading-4">
                {state === 'twice'
                  ? t('manager.menus.keypad.twice')
                  : row
                    ? target(row)
                    : t('manager.menus.keypad.free')}
              </span>
            </li>
          );
        })}
      </ul>
      {long.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {long.map((row, index) => (
            <li key={index} className="flex items-center gap-2 text-[13px] text-text-2">
              <KeyBadge
                value={f.digits(row.key)}
                size="sm"
                tone={twice.has(row.key) ? 'danger' : 'muted'}
              />
              <span className="min-w-0 truncate">{target(row)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** The greeting this menu plays, with a link to replace its file. */
function Greeting({ menu }: { menu: string }) {
  const { t } = useTranslation('sales');
  const name = useMenuName();
  const voices = useQuery(phoneVoicesQuery).data;
  const voice = voices?.voices.find((item) => item.menus.includes(menu));
  if (!voice) return null;
  return (
    <SectionCard id="phone-menu-greeting" variant="panel" title={t('manager.menus.greeting')}>
      <div className="flex items-center gap-3">
        <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-tint text-primary-text">
          <Icon name="microphone" size={20} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold">{name(voice.name)}</span>
        <Link
          to={salesPath('manager/phone/voices')}
          className="text-sm font-semibold whitespace-nowrap text-primary-text"
        >
          {t('manager.menus.newGreeting')}
        </Link>
      </div>
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
