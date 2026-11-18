import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { Notice } from '@/components/ui/Notice';
import { PageColumns } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SaveBar } from '@/components/ui/SaveBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { WEEKDAYS, type Weekday } from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';
import {
  consultationTypesQuery,
  overlapping,
  startsOf,
  useAddClosure,
  useRemoveClosure,
  useSaveConsultationType,
  type ConsultationMode,
  type ConsultationTypeInput,
  type ConsultationTypeRow,
  type WeekRow,
} from '../api';
import { useSalesFormat } from '../format';
import { salesPath } from '../paths';

/** Every quarter hour from 6:00 to midnight, `HH:MM`. */
const TIMES = Array.from({ length: 73 }, (_, i) =>
  [6 + Math.floor(i / 4), (i % 4) * 15].map((part) => String(part).padStart(2, '0')).join(':'),
).map((value) => (value === '24:00' ? '23:59' : value));
const LENGTHS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];
const STEPS = ['', '15', '20', '30', '45', '60', '75', '90', '120'];
const MODES: ConsultationMode[] = ['in_person', 'online'];

interface Draft {
  title: string;
  description: string;
  mode: ConsultationMode;
  active: boolean;
  price: string;
  discount: boolean;
  discountedPrice: string;
  /** `YYYY-MM-DD`: the discount holds to the end of that day. */
  discountUntil: string;
  length: number;
  /** Minutes between start times, '' for one per weekly row. */
  step: string;
  week: WeekRow[];
}

const localDay = (value: string) => {
  const day = new Date(value);
  return [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
};

function draftOf(item: ConsultationTypeRow | null): Draft {
  const discount = !!item?.discount_on;
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    mode: item?.mode ?? 'in_person',
    active: item?.active ?? true,
    price: item ? String(item.price) : '',
    discount,
    discountedPrice: discount && item.discounted_price ? String(item.discounted_price) : '',
    discountUntil: discount && item.discount_until ? localDay(item.discount_until) : '',
    length: item?.length ?? 60,
    step: item?.slot_minutes ? String(item.slot_minutes) : '',
    week: item?.week ?? [],
  };
}

/** What Django gets: the whole form (a new type) or only what the manager changed. */
function bodyOf(draft: Draft): ConsultationTypeInput & { mode: ConsultationMode } {
  const until = draft.discountUntil ? new Date(`${draft.discountUntil}T23:59:00`) : null;
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    mode: draft.mode,
    active: draft.active,
    price: Number(draft.price) || 0,
    discounted_price: draft.discount ? Number(draft.discountedPrice) || 0 : null,
    discount_until: draft.discount && until ? until.toISOString() : null,
    length: draft.length,
    slot_minutes: draft.step ? Number(draft.step) : null,
    week: draft.week,
  };
}

/** Field errors before saving; Django checks the same. */
function problemsOf(draft: Draft) {
  const price = Number(draft.price);
  const discounted = Number(draft.discountedPrice);
  return {
    title: !draft.title.trim(),
    price: draft.price === '' || !(price >= 0),
    discountedPrice: draft.discount && (!(discounted > 0) || discounted >= price),
    discountUntil: draft.discount && !draft.discountUntil,
    days: new Set(
      WEEKDAYS.filter((day) => {
        const rows = draft.week.filter((row) => row.day === day);
        return rows.some((row) => row.end <= row.start || row.capacity < 1) || overlapping(rows);
      }),
    ),
  };
}

/**
 * One consultation type (S81): price and discount, how long a session is and how often one starts,
 * the week, and the days or times it is closed. `new` makes a type; online or in person is chosen
 * then and stays.
 */
export default function ConsultationTypePage() {
  const { id } = useParams();
  const { data } = useSuspenseQuery(consultationTypesQuery);
  const item = id === 'new' ? null : (data.types.find((row) => String(row.id) === id) ?? null);
  const { t } = useTranslation('sales');
  if (id !== 'new' && !item)
    return (
      <>
        <BackLink to={salesPath('manager/consultations')}>
          {t('manager.consultations.back')}
        </BackLink>
        <EmptyState>{t('manager.consultations.missing')}</EmptyState>
      </>
    );
  return <TypeForm key={item?.id ?? 'new'} item={item} />;
}

function TypeForm({ item }: { item: ConsultationTypeRow | null }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const navigate = useNavigate();
  const save = useSaveConsultationType();
  const [draft, setDraft] = useState(() => draftOf(item));
  const [saved, setSaved] = useState(() => JSON.stringify(draftOf(item)));
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const set = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }));
  const dirty = JSON.stringify(draft) !== saved;
  const problems = problemsOf(draft);
  const show = (bad: boolean) => tried && bad;

  const submit = () => {
    setTried(true);
    setServerError(null);
    if (
      problems.title ||
      problems.price ||
      problems.discountedPrice ||
      problems.discountUntil ||
      problems.days.size
    )
      return;
    const { mode, ...change } = bodyOf(draft);
    save.mutate(item ? { ...change, id: item.id } : { ...change, mode }, {
      onSuccess: (row) => {
        toast.success(t(item ? 'manager.consultations.saved' : 'manager.consultations.created'));
        setTried(false);
        if (!item) {
          void navigate(salesPath(`manager/consultations/${String(row.id)}`), { replace: true });
          return;
        }
        const fresh = draftOf(row);
        setDraft(fresh);
        setSaved(JSON.stringify(fresh));
      },
      onError: (error) => {
        const body = error instanceof ApiError ? (error.body as Record<string, unknown>) : null;
        const first = body && Object.values(body).flat()[0];
        setServerError(typeof first === 'string' ? first : t('error'));
      },
    });
  };

  const lengthOptions = LENGTHS.map((value) => ({
    value: String(value),
    label: t('manager.consultations.minutes', { n: f.number(value) }),
  }));

  return (
    <form
      aria-label={item ? item.title : t('manager.consultations.new')}
      className="flex flex-col gap-4 lg:gap-7"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <BackLink to={salesPath('manager/consultations')}>{t('manager.consultations.back')}</BackLink>
      <PageHeader
        title={item ? item.title : t('manager.consultations.new')}
        subtitle={item ? t('manager.consultations.editHint') : t('manager.consultations.newHint')}
      />
      {serverError && <Notice tone="error">{serverError}</Notice>}
      <PageColumns
        asideLabel={t('manager.consultations.price.title')}
        main={
          <SectionCard
            id="consultation-week"
            title={t('manager.consultations.week.title')}
            subtitle={t('manager.consultations.week.subtitle')}
          >
            <WeekEditor
              week={draft.week}
              length={draft.length}
              step={draft.step ? Number(draft.step) : null}
              bad={tried ? problems.days : new Set()}
              onChange={(week) => set({ week })}
            />
          </SectionCard>
        }
        aside={
          <>
            <SectionCard
              id="consultation-about"
              variant="panel"
              title={t('manager.consultations.about.title')}
            >
              <div className="flex flex-col gap-4">
                <TextField
                  label={t('manager.consultations.about.name')}
                  value={draft.title}
                  maxLength={64}
                  onChange={(event) => set({ title: event.target.value })}
                  error={show(problems.title) ? t('manager.consultations.errors.title') : undefined}
                />
                {item ? (
                  <p className="m-0 text-[13px] text-text-2">
                    {t('manager.consultations.about.modeFixed', {
                      mode: t(`manager.consultations.mode.${item.mode}`),
                    })}
                  </p>
                ) : (
                  <ChoiceGroup
                    legend={t('manager.consultations.about.mode')}
                    look="segmented"
                    options={MODES.map((value) => ({
                      value,
                      label: t(`manager.consultations.mode.${value}`),
                    }))}
                    value={draft.mode}
                    onChange={(mode) => set({ mode })}
                  />
                )}
                <Switch
                  label={t('manager.consultations.about.active')}
                  description={t(
                    draft.active
                      ? 'manager.consultations.about.activeOn'
                      : 'manager.consultations.about.activeOff',
                  )}
                  checked={draft.active}
                  onChange={(active) => set({ active })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label={t('manager.consultations.about.length')}
                    value={String(draft.length)}
                    options={
                      LENGTHS.includes(draft.length)
                        ? lengthOptions
                        : [
                            {
                              value: String(draft.length),
                              label: t('manager.consultations.minutes', {
                                n: f.number(draft.length),
                              }),
                            },
                            ...lengthOptions,
                          ]
                    }
                    onChange={(value) => set({ length: Number(value) })}
                  />
                  <SelectField
                    label={t('manager.consultations.about.step')}
                    hint={t('manager.consultations.about.stepHint')}
                    value={draft.step}
                    options={(STEPS.includes(draft.step) ? STEPS : [draft.step, ...STEPS]).map(
                      (value) => ({
                        value,
                        label: value
                          ? t('manager.consultations.every', { n: f.number(Number(value)) })
                          : t('manager.consultations.about.stepRow'),
                      }),
                    )}
                    onChange={(step) => set({ step })}
                  />
                </div>
                <TextAreaField
                  label={t('manager.consultations.about.description')}
                  value={draft.description}
                  maxLength={2000}
                  rows={3}
                  onChange={(event) => set({ description: event.target.value })}
                />
              </div>
            </SectionCard>
            <SectionCard
              id="consultation-price"
              variant="panel"
              title={t('manager.consultations.price.title')}
            >
              <div className="flex flex-col gap-4">
                <TextField
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  min={0}
                  step={10000}
                  label={t('manager.consultations.price.price')}
                  value={draft.price}
                  hint={draft.price ? s.toman(Number(draft.price)) : undefined}
                  error={show(problems.price) ? t('manager.consultations.errors.price') : undefined}
                  onChange={(event) => set({ price: event.target.value })}
                />
                <Switch
                  label={t('manager.consultations.price.discount')}
                  description={t('manager.consultations.price.discountHint')}
                  checked={draft.discount}
                  onChange={(discount) => set({ discount })}
                />
                {draft.discount && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      type="number"
                      inputMode="numeric"
                      dir="ltr"
                      min={0}
                      step={10000}
                      label={t('manager.consultations.price.discounted')}
                      value={draft.discountedPrice}
                      hint={
                        draft.discountedPrice ? s.toman(Number(draft.discountedPrice)) : undefined
                      }
                      error={
                        show(problems.discountedPrice)
                          ? t('manager.consultations.errors.discounted')
                          : undefined
                      }
                      onChange={(event) => set({ discountedPrice: event.target.value })}
                    />
                    <LazyDatePicker
                      label={t('manager.consultations.price.until')}
                      value={draft.discountUntil}
                      only="future"
                      error={
                        show(problems.discountUntil)
                          ? t('manager.consultations.errors.until')
                          : undefined
                      }
                      onChange={(discountUntil) => set({ discountUntil })}
                    />
                  </div>
                )}
              </div>
            </SectionCard>
            {item && <Closures item={item} />}
          </>
        }
      />
      <SaveBar
        dirty={dirty}
        message={t(dirty ? 'manager.consultations.unsaved' : 'manager.consultations.allSaved')}
      >
        {dirty && item && (
          <Button variant="onLuxe" onClick={() => setDraft(JSON.parse(saved) as Draft)}>
            {t('manager.consultations.undo')}
          </Button>
        )}
        <Button
          type="submit"
          variant={dirty ? 'outline' : 'primary'}
          disabled={save.isPending || (!!item && !dirty)}
        >
          {t(item ? 'manager.consultations.save' : 'manager.consultations.create')}
        </Button>
      </SaveBar>
    </form>
  );
}

/** The week, a block per day: its times (from, to, people at each start) and the starts they make. */
function WeekEditor({
  week,
  length,
  step,
  bad,
  onChange,
}: {
  week: WeekRow[];
  length: number;
  step: number | null;
  bad: Set<Weekday>;
  onChange: (week: WeekRow[]) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const options = TIMES.map((value) => ({ value, label: f.digits(value) }));
  const withTime = (value: string) =>
    TIMES.includes(value) ? options : [{ value, label: f.digits(value) }, ...options];
  const rowsOf = (day: Weekday) => week.filter((row) => row.day === day);
  const replaceDay = (day: Weekday, rows: WeekRow[]) =>
    onChange([...week.filter((row) => row.day !== day), ...rows]);

  const copyToAll = (from: Weekday) => {
    const rows = rowsOf(from);
    onChange(WEEKDAYS.flatMap((day) => rows.map((row) => ({ ...row, day }))));
    toast.success(t('manager.consultations.week.copied', { day: t(`manager.hours.day.${from}`) }));
  };

  return (
    <ul
      className="m-0 flex list-none flex-col px-5 pb-5 lg:px-8 lg:pb-7"
      aria-label={t('manager.consultations.week.title')}
    >
      {WEEKDAYS.map((day) => {
        const rows = rowsOf(day);
        const name = t(`manager.hours.day.${day}`);
        const starts = rows
          .flatMap((row) => startsOf(row, length, step))
          .sort()
          .map((value) => f.digits(value));
        return (
          <li key={day} className="flex flex-col gap-3 border-b border-line-2 py-4 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-bold">{name}</span>
              <span className="flex gap-1">
                {rows.length > 0 && (
                  <Button
                    variant="outline"
                    className="h-11 px-4 text-sm"
                    onClick={() => copyToAll(day)}
                  >
                    {t('manager.consultations.week.copy')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-11 px-4 text-sm"
                  onClick={() => {
                    const last = rows.at(-1);
                    replaceDay(day, [
                      ...rows,
                      last
                        ? { ...last, start: last.end, end: last.end < '20:00' ? '21:00' : '23:59' }
                        : { day, start: '10:00', end: '17:00', capacity: 1 },
                    ]);
                  }}
                >
                  {t('manager.consultations.week.add')}
                </Button>
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="m-0 text-[13px] text-text-2">
                {t('manager.consultations.week.closed')}
              </p>
            ) : (
              <>
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 max-sm:grid-cols-3"
                  >
                    <SelectField
                      label={t('manager.consultations.week.from')}
                      value={row.start}
                      options={withTime(row.start)}
                      onChange={(start) =>
                        replaceDay(
                          day,
                          rows.map((item, at) => (at === index ? { ...item, start } : item)),
                        )
                      }
                    />
                    <SelectField
                      label={t('manager.consultations.week.to')}
                      value={row.end}
                      options={withTime(row.end)}
                      onChange={(end) =>
                        replaceDay(
                          day,
                          rows.map((item, at) => (at === index ? { ...item, end } : item)),
                        )
                      }
                    />
                    <TextField
                      type="number"
                      inputMode="numeric"
                      dir="ltr"
                      min={1}
                      max={50}
                      label={t('manager.consultations.week.capacity')}
                      value={String(row.capacity)}
                      onChange={(event) =>
                        replaceDay(
                          day,
                          rows.map((item, at) =>
                            at === index
                              ? {
                                  ...item,
                                  capacity: Math.min(
                                    50,
                                    Math.max(0, Math.round(Number(event.target.value))),
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <IconButton
                      icon="trash"
                      tone="danger"
                      aria-label={t('manager.consultations.week.remove', { day: name })}
                      onClick={() =>
                        replaceDay(
                          day,
                          rows.filter((_, at) => at !== index),
                        )
                      }
                    />
                  </div>
                ))}
                <p
                  className={`m-0 text-[13px] leading-6 ${bad.has(day) ? 'text-danger' : 'text-text-2'}`}
                  role={bad.has(day) ? 'alert' : undefined}
                >
                  {bad.has(day)
                    ? t('manager.consultations.errors.day')
                    : starts.length
                      ? t('manager.consultations.week.starts', {
                          n: f.number(starts.length),
                          list: starts.join('، '),
                        })
                      : t('manager.consultations.week.tooShort')}
                </p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Closed days and times, saved one by one (they don't wait for the save bar). */
function Closures({ item }: { item: ConsultationTypeRow }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const add = useAddClosure(item.id);
  const remove = useRemoveClosure();
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [pickError, setPickError] = useState(false);
  const weekday = day ? WEEKDAYS[(new Date(`${day}T12:00:00`).getDay() + 1) % 7] : undefined;
  const starts = weekday
    ? item.week
        .filter((row) => row.day === weekday)
        .flatMap((row) => startsOf(row, item.length, item.slot_minutes))
        .sort()
    : [];

  const submit = () => {
    if (!day) {
      setPickError(true);
      return;
    }
    add.mutate(
      { date: day, time: time || null },
      {
        onSuccess: () => {
          setDay('');
          setTime('');
          toast.success(t('manager.consultations.closures.added'));
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('manager.consultations.closures.exists')
              : t('error'),
          ),
      },
    );
  };

  return (
    <SectionCard
      id="consultation-closures"
      variant="panel"
      title={t('manager.consultations.closures.title')}
      subtitle={t('manager.consultations.closures.subtitle')}
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <LazyDatePicker
            label={t('manager.consultations.closures.day')}
            value={day}
            only="future"
            error={pickError ? t('manager.consultations.closures.pickFirst') : undefined}
            onChange={(value) => {
              setDay(value);
              setTime('');
              setPickError(false);
            }}
          />
          <SelectField
            label={t('manager.consultations.closures.time')}
            value={time}
            options={[
              { value: '', label: t('manager.consultations.closures.allDay') },
              ...starts.map((value) => ({ value, label: f.digits(value) })),
            ]}
            onChange={setTime}
          />
        </div>
        <Button variant="outline" onClick={submit} disabled={add.isPending}>
          {t('manager.consultations.closures.add')}
        </Button>
        {item.closures.length === 0 ? (
          <EmptyState>{t('manager.consultations.closures.empty')}</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {item.closures.map((closure) => {
              const label = `${f.weekday(closure.date)} ${f.date(closure.date)}`;
              return (
                <li
                  key={closure.id}
                  className="flex min-h-12 items-center justify-between gap-2 border-b border-line-2 last:border-b-0"
                >
                  <span className="text-[15px] text-text">
                    {label}
                    <span className="text-text-2">
                      {' · '}
                      {closure.time
                        ? f.digits(closure.time)
                        : t('manager.consultations.closures.allDay')}
                    </span>
                  </span>
                  <IconButton
                    icon="trash"
                    tone="danger"
                    aria-label={t('manager.consultations.closures.remove', { day: label })}
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(closure.id, {
                        onSuccess: () => toast.success(t('manager.consultations.closures.removed')),
                        onError: () => toast.error(t('error')),
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
