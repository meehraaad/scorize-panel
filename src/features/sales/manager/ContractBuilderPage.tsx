import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField, TogglePill } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { DiffText } from '@/components/ui/DiffText';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  contractBuilderQuery,
  useOrderClauses,
  useSaveClause,
  useSavePrices,
  useSaveRules,
  type BuilderClause,
  type BuilderPrice,
  type OfferRules,
  type TextVersion,
} from '../api';
import { useSalesFormat } from '../format';

const TABS = ['clauses', 'prices', 'versions'] as const;
type Tab = (typeof TABS)[number];
/** What the manager picks from for the offer's discounts and durations. */
const DISCOUNT_STEPS = [5, 10, 15, 20, 25, 30];
const DURATION_STEPS = [3, 6, 9, 12, 18, 24];

/**
 * The sales manager's contract builder (S64): the standard contract's clauses (write, order, fix
 * so sellers can't change them, take out), the price list and the offer's rules, and the text's
 * versions. Canvas "صفحه‌ی مشتری", boards "ساخت قرارداد".
 */
export default function ContractBuilderPage() {
  const { t } = useTranslation('sales');
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((value) => value === params.get('tab')) ?? 'clauses';
  return (
    <>
      <PageHeader
        title={t('manager.builder.title')}
        subtitle={t('manager.builder.subtitle')}
        actions={
          <ChoiceGroup
            legend={t('manager.builder.tabs')}
            hideLegend
            look="segmented"
            value={tab}
            onChange={(next) =>
              setParams(
                (search) => {
                  search.set('tab', next);
                  return search;
                },
                { replace: true },
              )
            }
            options={TABS.map((value) => ({ value, label: t(`manager.builder.tab.${value}`) }))}
          />
        }
      />
      {tab === 'clauses' ? <Clauses /> : tab === 'prices' ? <PricesAndRules /> : <Versions />}
    </>
  );
}

// region Clauses
function Clauses() {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(contractBuilderQuery);
  const order = useOrderClauses();
  const active = data.clauses.filter((clause) => clause.is_active);
  const out = data.clauses.filter((clause) => !clause.is_active);
  const [adding, setAdding] = useState(false);

  const move = (index: number, by: -1 | 1) => {
    const ids = active.map((clause) => clause.id);
    const [id] = ids.splice(index, 1);
    if (id === undefined) return;
    ids.splice(index + by, 0, id);
    order.mutate(ids, { onError: () => toast.error(t('error')) });
  };

  return (
    <>
      <SectionCard
        id="clauses"
        variant="panel"
        title={t('manager.builder.clauses.title', { n: active.length })}
        subtitle={t('manager.builder.clauses.subtitle')}
        end={
          !adding && (
            <Button variant="outline" onClick={() => setAdding(true)}>
              {t('manager.builder.clauses.add')}
            </Button>
          )
        }
      >
        {adding && <ClauseForm onDone={() => setAdding(false)} />}
        {active.length === 0 ? (
          <EmptyState>{t('manager.builder.clauses.empty')}</EmptyState>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {active.map((clause, index) => (
              <ClauseRow
                key={clause.id}
                clause={clause}
                index={index}
                first={index === 0}
                last={index === active.length - 1}
                moving={order.isPending}
                onMove={(by) => move(index, by)}
              />
            ))}
          </ol>
        )}
      </SectionCard>
      {out.length > 0 && (
        <SectionCard id="clauses-out" variant="panel" title={t('manager.builder.clauses.out')}>
          <ul className="m-0 flex list-none flex-col p-0">
            {out.map((clause) => (
              <OutRow key={clause.id} clause={clause} />
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}

function ClauseRow({
  clause,
  index,
  first,
  last,
  moving,
  onMove,
}: {
  clause: BuilderClause;
  index: number;
  first: boolean;
  last: boolean;
  moving: boolean;
  onMove: (by: -1 | 1) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold">
            {f.number(index + 1)}. {clause.title}
          </span>
          {clause.locked && (
            <Chip tone="neutral" small>
              {t('manager.builder.clauses.locked')}
            </Chip>
          )}
        </span>
        <IconButton
          icon="chevronDown"
          tone="muted"
          className="rotate-180"
          aria-label={t('manager.builder.clauses.up', { name: clause.title })}
          disabled={first || moving}
          onClick={() => onMove(-1)}
        />
        <IconButton
          icon="chevronDown"
          tone="muted"
          aria-label={t('manager.builder.clauses.down', { name: clause.title })}
          disabled={last || moving}
          onClick={() => onMove(1)}
        />
        <IconButton
          icon="pen"
          tone="muted"
          aria-label={t('manager.builder.clauses.edit', { name: clause.title })}
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        />
      </div>
      {editing ? (
        <ClauseForm clause={clause} onDone={() => setEditing(false)} />
      ) : (
        <p className="m-0 line-clamp-3 text-sm leading-7 whitespace-pre-line text-neutral">
          {clause.text}
        </p>
      )}
    </li>
  );
}

/** A new clause (no `clause`) or one being changed: title, text, fixed or not; or take it out. */
function ClauseForm({ clause, onDone }: { clause?: BuilderClause; onDone: () => void }) {
  const { t } = useTranslation('sales');
  const save = useSaveClause();
  const [title, setTitle] = useState(clause?.title ?? '');
  const [text, setText] = useState(clause?.text ?? '');
  const [locked, setLocked] = useState(clause?.locked ?? false);
  const ready = title.trim() !== '' && text.trim() !== '';

  const send = (body: Parameters<typeof save.mutate>[0], done: string) =>
    save.mutate(body, {
      onSuccess: () => {
        toast.success(done);
        onDone();
      },
      onError: () => toast.error(t('error')),
    });

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-canvas p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready)
          send(
            { ...(clause && { id: clause.id }), title: title.trim(), text: text.trim(), locked },
            t(clause ? 'manager.builder.clauses.saved' : 'manager.builder.clauses.added'),
          );
      }}
    >
      <TextField
        label={t('manager.builder.clauses.name')}
        value={title}
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
      />
      <TextAreaField
        label={t('manager.builder.clauses.text')}
        hint={t('manager.builder.clauses.textHint')}
        rows={5}
        maxLength={5000}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Switch
        label={t('manager.builder.clauses.fix')}
        description={t('manager.builder.clauses.fixText')}
        checked={locked}
        onChange={setLocked}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!ready || save.isPending}>
          {t('manager.builder.save')}
        </Button>
        <Button variant="outline" onClick={onDone}>
          {t('manager.builder.cancel')}
        </Button>
        {clause && (
          <Button
            variant="danger"
            className="ms-auto"
            disabled={save.isPending}
            onClick={() =>
              send({ id: clause.id, is_active: false }, t('manager.builder.clauses.removed'))
            }
          >
            {t('manager.builder.clauses.remove', { name: clause.title })}
          </Button>
        )}
      </div>
    </form>
  );
}

function OutRow({ clause }: { clause: BuilderClause }) {
  const { t } = useTranslation('sales');
  const save = useSaveClause();
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 shadow-[inset_0_1px_0_var(--hair)] first:shadow-none">
      <span className="min-w-0 truncate text-sm text-text-2">{clause.title}</span>
      <Button
        variant="outline"
        className="h-10 px-4 text-[13px]"
        disabled={save.isPending}
        onClick={() =>
          save.mutate(
            { id: clause.id, is_active: true },
            {
              onSuccess: () => toast.success(t('manager.builder.clauses.back')),
              onError: () => toast.error(t('error')),
            },
          )
        }
      >
        {t('manager.builder.clauses.restore', { name: clause.title })}
      </Button>
    </li>
  );
}
// endregion

// region Prices and rules
function PricesAndRules() {
  const { data } = useSuspenseQuery(contractBuilderQuery);
  return (
    <>
      <Prices prices={data.prices} />
      <Rules rules={data.rules} />
    </>
  );
}

function Prices({ prices }: { prices: BuilderPrice[] }) {
  const { t } = useTranslation('sales');
  const s = useSalesFormat();
  const save = useSavePrices();
  const [rows, setRows] = useState(prices);
  const change = (index: number, row: Partial<BuilderPrice>) =>
    setRows(rows.map((item, at) => (at === index ? { ...item, ...row } : item)));
  return (
    <SectionCard
      id="prices"
      variant="panel"
      title={t('manager.builder.prices.title')}
      subtitle={t('manager.builder.prices.subtitle')}
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row, index) => (
          <li
            key={row.feature}
            className="grid grid-cols-1 items-start gap-2 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--line-2)] sm:grid-cols-[1fr_auto]"
          >
            <TextField
              type="number"
              inputMode="numeric"
              dir="ltr"
              min={0}
              step={1_000_000}
              label={t(`manager.builder.prices.feature.${row.feature}`)}
              value={row.price === null ? '' : String(row.price)}
              hint={row.price ? s.toman(row.price) : t('manager.builder.prices.none')}
              onChange={(event) =>
                change(index, {
                  price:
                    event.target.value === ''
                      ? null
                      : Math.max(0, Math.round(Number(event.target.value))),
                })
              }
            />
            <Switch
              label={t('manager.builder.prices.offered')}
              checked={row.is_active && !!row.price}
              disabled={!row.price}
              onChange={(is_active) => change(index, { is_active })}
            />
          </li>
        ))}
      </ul>
      <div>
        <Button
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              rows.map((row) => ({
                feature: row.feature,
                price: row.price ?? 0,
                is_active: row.is_active,
              })),
              {
                onSuccess: () => toast.success(t('manager.builder.prices.saved')),
                onError: () => toast.error(t('error')),
              },
            )
          }
        >
          {t('manager.builder.save')}
        </Button>
      </div>
    </SectionCard>
  );
}

function Rules({ rules }: { rules: OfferRules }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSaveRules();
  const [form, setForm] = useState(rules);
  const set = <K extends keyof OfferRules>(key: K, value: OfferRules[K]) =>
    setForm({ ...form, [key]: value });
  const toggle = (list: number[], value: number, on: boolean) =>
    (on ? [...list, value] : list.filter((item) => item !== value)).sort((a, b) => a - b);
  const numberField = (
    key: 'approval_above' | 'min_prepayment' | 'max_instalments' | 'max_applies',
    max: number,
  ) => (
    <TextField
      type="number"
      inputMode="numeric"
      dir="ltr"
      min={key === 'max_instalments' || key === 'max_applies' ? 1 : 0}
      max={max}
      label={t(`manager.builder.rules.${key}`)}
      hint={t(`manager.builder.rules.${key}Hint`)}
      value={String(form[key])}
      onChange={(event) =>
        set(key, Math.min(max, Math.max(0, Math.round(Number(event.target.value)))))
      }
    />
  );
  const steps = (
    key: 'discounts' | 'durations',
    values: number[],
    label: 'manager.builder.rules.percent' | 'manager.builder.rules.months',
  ) => (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-2.5 text-[15px] font-medium">
        {t(`manager.builder.rules.${key}`)}
      </legend>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <TogglePill
            key={value}
            label={t(label, { n: f.number(value) })}
            checked={form[key].includes(value)}
            onChange={(on) => set(key, toggle(form[key], value, on))}
          />
        ))}
      </div>
    </fieldset>
  );
  const valid = form.durations.length > 0;
  return (
    <SectionCard
      id="rules"
      variant="panel"
      title={t('manager.builder.rules.title')}
      subtitle={t('manager.builder.rules.subtitle')}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {numberField('approval_above', 100)}
        {numberField('min_prepayment', 100)}
        {numberField('max_instalments', 12)}
        {numberField('max_applies', 60)}
      </div>
      {steps('discounts', DISCOUNT_STEPS, 'manager.builder.rules.percent')}
      {steps('durations', DURATION_STEPS, 'manager.builder.rules.months')}
      <div>
        <Button
          disabled={!valid || save.isPending}
          onClick={() =>
            save.mutate(form, {
              onSuccess: () => toast.success(t('manager.builder.rules.saved')),
              onError: () => toast.error(t('error')),
            })
          }
        >
          {t('manager.builder.save')}
        </Button>
      </div>
    </SectionCard>
  );
}
// endregion

// region Versions
function Versions() {
  const { t } = useTranslation('sales');
  const { data } = useSuspenseQuery(contractBuilderQuery);
  return (
    <SectionCard
      id="versions"
      variant="panel"
      title={t('manager.builder.versions.title')}
      subtitle={t('manager.builder.versions.subtitle')}
    >
      {data.versions.length === 0 ? (
        <EmptyState>{t('manager.builder.versions.empty')}</EmptyState>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {data.versions.map((version, index) => (
            <VersionRow key={version.number} version={version} current={index === 0} />
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function VersionRow({ version, current }: { version: TextVersion; current: boolean }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  return (
    <li className="flex gap-3 py-4 shadow-[inset_0_1px_0_var(--hair)] first:shadow-none">
      <span
        aria-hidden="true"
        className={`flex size-10 flex-none items-center justify-center rounded-xl text-sm font-bold ${current ? 'bg-primary text-on-primary' : 'bg-tint text-primary-text'}`}
      >
        {f.number(version.number)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold">
            {version.note || t('manager.builder.versions.first')}
          </span>
          {current && (
            <Chip tone="good" small>
              {t('manager.builder.versions.current')}
            </Chip>
          )}
        </span>
        <span className="text-[13px] text-text-2">
          {t('manager.builder.versions.meta', {
            n: f.number(version.number),
            clauses: f.number(version.clauses),
          })}
          {version.author && ` · ${version.author}`}
          {' · '}
          <time dateTime={version.created_at}>{f.timeAgo(version.created_at)}</time>
        </span>
        {version.changes
          .filter((change) => change.kind === 'changed' && change.before !== null)
          .map((change) => (
            <p key={change.title} className="m-0 rounded-xl bg-canvas p-3 text-sm leading-7">
              <DiffText
                before={change.before ?? ''}
                after={change.text}
                addedLabel={t('manager.approvals.clauses.addedText')}
                removedLabel={t('manager.approvals.clauses.removedText')}
              />
            </p>
          ))}
      </div>
    </li>
  );
}
// endregion
