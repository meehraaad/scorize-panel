import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField, TogglePill } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { DiffText } from '@/components/ui/DiffText';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { namesIn, numberClauses, token, useClauseLabel, type ClauseKind } from '@/lib/contractText';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  contractBuilderQuery,
  templateParam,
  useCreateTemplate,
  useOrderClauses,
  useSaveClause,
  useSavePrices,
  useSaveRules,
  useSaveVariables,
  useUpdateTemplate,
  type BuilderClause,
  type BuilderPrice,
  type ContractBuilder,
  type OfferRules,
  type RuleLimits,
  type TextVersion,
} from '../api';
import { ContractSheet } from '../components/ContractSheet';
import { useSalesFormat } from '../format';
import { previewClauses, sampleDocument, sampleValues, type ClauseDraft } from './contractPreview';

const TABS = ['clauses', 'prices', 'versions'] as const;
type Tab = (typeof TABS)[number];
/** What the manager picks from for the offer's discounts and durations. */
const DISCOUNT_STEPS = [5, 10, 15, 20, 25, 30];
const DURATION_STEPS = [3, 6, 9, 12, 18, 24];
/** The standard contract's value in the kinds-of-contract choice (its id is null). */
const STANDARD = 'standard';

/**
 * The sales manager's contract builder (S64): the kinds of contract (S68: the standard one and the
 * templates beside it, e.g. free apply to Turkey or visa only), and for the one picked its clauses
 * (write, order, fix so sellers can't change them, take out) beside the contract as it will print,
 * its price list and offer rules, and its text's versions. Canvas "صفحه‌ی مشتری", boards
 * "ساخت قرارداد".
 */
export default function ContractBuilderPage() {
  const { t } = useTranslation('sales');
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((value) => value === params.get('tab')) ?? 'clauses';
  const template = templateParam(params.get('template'));
  const { data } = useSuspenseQuery(contractBuilderQuery(template));
  const pick = (id: number | null) =>
    setParams((search) => {
      if (id === null) search.delete('template');
      else search.set('template', String(id));
      return search;
    });
  // Each kind of contract keeps its own forms: switching starts them from its own data.
  const kind = template ?? STANDARD;

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
      <Templates key={`templates-${kind}`} data={data} onPick={pick} />
      {tab === 'clauses' ? (
        <Clauses key={`clauses-${kind}`} data={data} />
      ) : tab === 'prices' ? (
        <PricesAndRules key={`prices-${kind}`} data={data} />
      ) : (
        <Versions data={data} />
      )}
    </>
  );
}

// region Kinds of contract (S68)
function Templates({
  data,
  onPick,
}: {
  data: ContractBuilder;
  onPick: (id: number | null) => void;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [adding, setAdding] = useState(false);
  const current = data.template;
  return (
    <SectionCard
      id="templates"
      variant="panel"
      title={t('manager.builder.templates.title')}
      subtitle={t('manager.builder.templates.subtitle')}
    >
      <ChoiceGroup
        legend={t('manager.builder.templates.title')}
        hideLegend
        value={current.id === null ? STANDARD : String(current.id)}
        onChange={(value) => onPick(value === STANDARD ? null : Number(value))}
        options={data.templates.map((row) => ({
          value: row.id === null ? STANDARD : String(row.id),
          label: row.is_active
            ? t('manager.builder.templates.option', { name: row.name, n: f.number(row.clauses) })
            : t('manager.builder.templates.optionOff', { name: row.name }),
        }))}
        extra={
          !adding && (
            <Button variant="outline" onClick={() => setAdding(true)}>
              {t('manager.builder.templates.add')}
            </Button>
          )
        }
      />
      {adding && (
        <NewTemplate
          from={current}
          onDone={(id) => {
            setAdding(false);
            if (id !== undefined) onPick(id);
          }}
        />
      )}
      {current.id === null ? (
        <p className="m-0 text-sm leading-7 text-text-2">
          {t('manager.builder.templates.standardNote')}
        </p>
      ) : (
        <TemplateSettings template={{ ...current, id: current.id }} />
      )}
    </SectionCard>
  );
}

/** A new kind of contract: empty, or a copy of the one shown (its clauses, prices and rules). */
function NewTemplate({
  from,
  onDone,
}: {
  from: ContractBuilder['template'];
  onDone: (id?: number) => void;
}) {
  const { t } = useTranslation('sales');
  const create = useCreateTemplate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState<'copy' | 'empty'>('copy');
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-canvas p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        create.mutate(
          {
            name: name.trim(),
            description: description.trim(),
            copy: start === 'copy',
            copy_from: from.id,
          },
          {
            onSuccess: ({ id }) => {
              toast.success(t('manager.builder.templates.added', { name: name.trim() }));
              onDone(id);
            },
            onError: () => toast.error(t('error')),
          },
        );
      }}
    >
      <TextField
        label={t('manager.builder.templates.name')}
        placeholder={t('manager.builder.templates.namePlaceholder')}
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label={t('manager.builder.templates.description')}
        hint={t('manager.builder.templates.descriptionHint')}
        value={description}
        maxLength={300}
        onChange={(event) => setDescription(event.target.value)}
      />
      <ChoiceGroup
        legend={t('manager.builder.templates.start')}
        look="cards"
        value={start}
        onChange={setStart}
        options={[
          {
            value: 'copy',
            label: t('manager.builder.templates.copy', { name: from.name }),
            hint: t('manager.builder.templates.copyHint'),
          },
          {
            value: 'empty',
            label: t('manager.builder.templates.empty'),
            hint: t('manager.builder.templates.emptyHint'),
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {t('manager.builder.templates.create')}
        </Button>
        <Button variant="outline" onClick={() => onDone()}>
          {t('manager.builder.cancel')}
        </Button>
      </div>
    </form>
  );
}

/** A template's name, description, and whether sellers can start from it. */
function TemplateSettings({
  template,
}: {
  template: ContractBuilder['template'] & { id: number };
}) {
  const { t } = useTranslation('sales');
  const update = useUpdateTemplate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const send = (body: Parameters<typeof update.mutate>[0], done: string, after?: () => void) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success(done);
        after?.();
      },
      onError: () => toast.error(t('error')),
    });

  if (editing)
    return (
      <form
        className="flex flex-col gap-3 rounded-2xl bg-canvas p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim())
            send(
              { id: template.id, name: name.trim(), description: description.trim() },
              t('manager.builder.templates.saved'),
              () => setEditing(false),
            );
        }}
      >
        <TextField
          label={t('manager.builder.templates.name')}
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('manager.builder.templates.description')}
          value={description}
          maxLength={300}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!name.trim() || update.isPending}>
            {t('manager.builder.save')}
          </Button>
          <Button variant="outline" onClick={() => setEditing(false)}>
            {t('manager.builder.cancel')}
          </Button>
        </div>
      </form>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{template.name}</span>
        <span className="text-[13px] text-text-2">
          {template.description || t('manager.builder.templates.noDescription')}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-3">
        <Switch
          label={t('manager.builder.templates.offered')}
          checked={template.is_active}
          disabled={update.isPending}
          onChange={(is_active) =>
            send(
              { id: template.id, is_active },
              t(
                is_active
                  ? 'manager.builder.templates.turnedOn'
                  : 'manager.builder.templates.turnedOff',
                { name: template.name },
              ),
            )
          }
        />
        <IconButton
          icon="pen"
          tone="muted"
          aria-label={t('manager.builder.templates.rename', { name: template.name })}
          onClick={() => setEditing(true)}
        />
      </span>
    </div>
  );
}
// endregion

// region Clauses, beside the contract as it will print
function Clauses({ data }: { data: ContractBuilder }) {
  const { t } = useTranslation('sales');
  const label = useClauseLabel();
  const template = data.template.id;
  const order = useOrderClauses(template);
  const active = data.clauses.filter((clause) => clause.is_active);
  const out = data.clauses.filter((clause) => !clause.is_active);
  const numbers = numberClauses(active);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ClauseDraft | null>(null);
  const [big, setBig] = useState(false);
  const { clauses, highlight } = previewClauses(
    active,
    draft,
    t('manager.builder.preview.newClause'),
  );
  const doc = sampleDocument(data, clauses, t('manager.builder.preview.customer'));
  const values = sampleValues(data);
  const empty = t('manager.builder.preview.empty');

  const move = (index: number, by: -1 | 1) => {
    const ids = active.map((clause) => clause.id);
    const [id] = ids.splice(index, 1);
    if (id === undefined) return;
    ids.splice(index + by, 0, id);
    order.mutate(ids, { onError: () => toast.error(t('error')) });
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
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
          {active.length === 0 && !adding ? (
            <EmptyState>{t('manager.builder.clauses.empty')}</EmptyState>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {active.map((clause, index) => (
                <ClauseRow
                  key={clause.id}
                  data={data}
                  clause={clause}
                  name={nameOf(
                    clause,
                    label(numbers[index] ?? { kind: 'article', article: 0, n: 0 }),
                  )}
                  first={index === 0}
                  last={index === active.length - 1}
                  moving={order.isPending}
                  onMove={(by) => move(index, by)}
                  onDraft={setDraft}
                />
              ))}
            </ol>
          )}
          {adding && (
            <ClauseForm
              data={data}
              // A first clause starts the contract's first article; then clauses fill it.
              kind={active.length === 0 ? 'article' : 'clause'}
              onDraft={setDraft}
              onDone={() => setAdding(false)}
            />
          )}
        </SectionCard>
        <Variables
          key={`${String(template)}-${data.variables.map((row) => row.name).join('|')}`}
          data={data}
        />
        {out.length > 0 && (
          <SectionCard id="clauses-out" variant="panel" title={t('manager.builder.clauses.out')}>
            <ul className="m-0 flex list-none flex-col p-0">
              {out.map((clause) => (
                <OutRow key={clause.id} template={template} clause={clause} />
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      <section
        aria-labelledby="contract-preview"
        className="flex min-w-0 flex-col gap-3 rounded-card bg-surface p-4 shadow-panel sm:p-5 xl:sticky xl:top-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 flex-col gap-0.5">
            <h2 id="contract-preview" className="m-0 text-base font-bold">
              {t('manager.builder.preview.title')}
            </h2>
            <span className="text-[13px] text-text-2">{t('manager.builder.preview.hint')}</span>
          </span>
          <Button variant="outline" className="h-10 px-4 text-[13px]" onClick={() => setBig(true)}>
            {t('manager.builder.preview.open')}
          </Button>
        </div>
        {/* Beside the clauses on wide screens; on smaller ones the button opens it whole. */}
        <div className="hidden max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl bg-canvas p-3 xl:block">
          <ContractSheet
            doc={doc}
            framed={false}
            highlight={highlight}
            emptyClauses={empty}
            values={values}
          />
        </div>
      </section>

      <Dialog
        open={big}
        onClose={() => setBig(false)}
        size="wide"
        title={t('manager.builder.preview.title')}
        subtitle={data.template.name}
        closeLabel={t('close')}
      >
        <ContractSheet doc={doc} framed={false} emptyClauses={empty} values={values} />
      </Dialog>
    </div>
  );
}

/** How a clause is named in the list and its buttons: "ماده ۲: تعهدات"، "۲-۱"، "تبصره ۱". */
const nameOf = (clause: { kind: ClauseKind; title: string }, number: string) =>
  clause.kind === 'article' && clause.title ? `${number}: ${clause.title}` : number;

function ClauseRow({
  data,
  clause,
  name,
  first,
  last,
  moving,
  onMove,
  onDraft,
}: {
  data: ContractBuilder;
  clause: BuilderClause;
  /** Its number as the contract prints it, and an article's title. */
  name: string;
  first: boolean;
  last: boolean;
  moving: boolean;
  onMove: (by: -1 | 1) => void;
  onDraft: (draft: ClauseDraft | null) => void;
}) {
  const { t } = useTranslation('sales');
  const [editing, setEditing] = useState(false);
  const article = clause.kind === 'article';
  return (
    <li
      className={`flex flex-col gap-2.5 rounded-2xl p-4 ${article ? 'bg-canvas' : 'ms-5 shadow-[inset_0_0_0_1px_var(--line-2)]'}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className={`text-[15px] ${article ? 'font-extrabold' : 'font-bold'}`}>{name}</span>
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
          aria-label={t('manager.builder.clauses.up', { name })}
          disabled={first || moving}
          onClick={() => onMove(-1)}
        />
        <IconButton
          icon="chevronDown"
          tone="muted"
          aria-label={t('manager.builder.clauses.down', { name })}
          disabled={last || moving}
          onClick={() => onMove(1)}
        />
        <IconButton
          icon="pen"
          tone="muted"
          aria-label={t('manager.builder.clauses.edit', { name })}
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        />
      </div>
      {editing ? (
        <ClauseForm
          data={data}
          clause={clause}
          name={name}
          onDraft={onDraft}
          onDone={() => setEditing(false)}
        />
      ) : (
        clause.text && (
          <p className="m-0 line-clamp-3 text-sm leading-7 whitespace-pre-line text-neutral">
            {clause.text}
          </p>
        )
      )}
    </li>
  );
}

const KINDS = ['article', 'clause', 'note'] as const satisfies readonly ClauseKind[];

/**
 * A new clause (no `clause`) or one being changed: an article (title, an optional paragraph), a
 * clause or a note (a text); fixed or not; or take it out. The text may name the kind of
 * contract's variables, put in where the cursor is. What is typed shows in the preview at once
 * (`onDraft`), before it is saved.
 */
function ClauseForm({
  data,
  clause,
  name = '',
  kind: startKind = 'clause',
  onDraft,
  onDone,
}: {
  data: ContractBuilder;
  clause?: BuilderClause;
  name?: string;
  /** What a new one starts as. */
  kind?: ClauseKind;
  onDraft: (draft: ClauseDraft | null) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation();
  const save = useSaveClause(data.template.id);
  const [kind, setKind] = useState<ClauseKind>(clause?.kind ?? startKind);
  const [title, setTitle] = useState(clause?.title ?? '');
  const [text, setText] = useState(clause?.text ?? '');
  const [locked, setLocked] = useState(clause?.locked ?? false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const article = kind === 'article';
  const ready = article ? title.trim() !== '' : text.trim() !== '';
  const id = clause?.id ?? null;
  const known = new Set([...data.builtins, ...data.variables].map((row) => row.name));
  const unknown = namesIn(text).filter((item) => !known.has(item));

  useEffect(() => {
    onDraft({ id, kind, title, text });
  }, [id, kind, title, text, onDraft]);
  // Closed (saved or not): the preview shows the saved text again.
  useEffect(() => () => onDraft(null), [onDraft]);

  /** Puts `{{name}}` where the cursor is (at the end when the text was never focused). */
  const insert = (variable: string) => {
    const field = textRef.current;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? text.length;
    const piece = token(variable);
    setText(text.slice(0, start) + piece + text.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + piece.length, start + piece.length);
    });
  };

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
      className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line-2)]"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready)
          send(
            {
              ...(clause && { id: clause.id }),
              kind,
              title: article ? title.trim() : '',
              text: text.trim(),
              locked,
            },
            t(clause ? 'manager.builder.clauses.saved' : 'manager.builder.clauses.added'),
          );
      }}
    >
      <ChoiceGroup
        legend={t('manager.builder.clauses.kind')}
        look="segmented"
        options={KINDS.map((value) => ({ value, label: tc(`clauseNumber.kinds.${value}`) }))}
        value={kind}
        onChange={setKind}
        hint={t(`manager.builder.clauses.kindHint.${kind}`)}
      />
      {article && (
        <TextField
          label={t('manager.builder.clauses.name')}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
      )}
      <TextAreaField
        ref={textRef}
        label={
          article ? t('manager.builder.clauses.articleText') : t('manager.builder.clauses.text')
        }
        hint={t('manager.builder.clauses.textHint')}
        rows={4}
        maxLength={5000}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-text-2">
          {t('manager.builder.variables.insert')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {[...data.variables, ...data.builtins].map((row) => (
            <button
              key={row.name}
              type="button"
              className="min-h-9 rounded-full bg-tint px-3 text-[13px] font-semibold text-primary-text"
              aria-label={t('manager.builder.variables.insertOne', { name: row.name })}
              onClick={() => insert(row.name)}
            >
              {row.name}
            </button>
          ))}
        </div>
        {unknown.length > 0 && (
          <p className="m-0 text-[13px] text-warn">
            {t('manager.builder.variables.unknown', { names: unknown.join('، ') })}
          </p>
        )}
      </div>
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
            {t('manager.builder.clauses.remove', { name })}
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * The kind of contract's blanks (S69): each a name the clauses use as `{{name}}` and the value a
 * seller starts from; the seller fills them for each customer. What the system fills (the
 * customer's name, the amount…) is listed beside them.
 */
function Variables({ data }: { data: ContractBuilder }) {
  const { t } = useTranslation('sales');
  const save = useSaveVariables(data.template.id);
  const [rows, setRows] = useState(data.variables);
  const builtin = new Set(data.builtins.map((row) => row.name));
  const names = rows.map((row) => row.name.trim());
  const problem = names.some((name) => !name || /[{}]/.test(name))
    ? t('manager.builder.variables.nameNeeded')
    : names.some((name) => builtin.has(name))
      ? t('manager.builder.variables.builtin')
      : new Set(names).size !== names.length
        ? t('manager.builder.variables.twice')
        : null;
  const dirty = JSON.stringify(rows) !== JSON.stringify(data.variables);
  const set = (index: number, row: Partial<(typeof rows)[number]>) =>
    setRows(rows.map((item, at) => (at === index ? { ...item, ...row } : item)));

  return (
    <SectionCard
      id="variables"
      variant="panel"
      title={t('manager.builder.variables.title')}
      subtitle={t('manager.builder.variables.subtitle')}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!problem)
            save.mutate(
              rows.map((row) => ({ name: row.name.trim(), default: row.default.trim() })),
              {
                onSuccess: () => toast.success(t('manager.builder.variables.saved')),
                onError: () => toast.error(t('error')),
              },
            );
        }}
      >
        {rows.length === 0 && (
          <p className="m-0 text-sm text-text-2">{t('manager.builder.variables.empty')}</p>
        )}
        {rows.map((row, index) => (
          <div key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <TextField
              label={t('manager.builder.variables.name')}
              value={row.name}
              maxLength={50}
              onChange={(event) => set(index, { name: event.target.value })}
            />
            <TextField
              label={t('manager.builder.variables.default')}
              value={row.default}
              maxLength={200}
              onChange={(event) => set(index, { default: event.target.value })}
            />
            <IconButton
              icon="trash"
              tone="muted"
              aria-label={t('manager.builder.variables.remove', {
                name: row.name || t('manager.builder.variables.name'),
              })}
              onClick={() => setRows(rows.filter((_, at) => at !== index))}
            />
          </div>
        ))}
        {problem && <p className="m-0 text-[13px] text-warn">{problem}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRows([...rows, { name: '', default: '' }])}>
            {t('manager.builder.variables.add')}
          </Button>
          {dirty && (
            <Button type="submit" disabled={problem !== null || save.isPending}>
              {t('manager.builder.variables.save')}
            </Button>
          )}
        </div>
        <p className="m-0 text-[13px] leading-6 text-text-2">
          {t('manager.builder.variables.system', {
            names: data.builtins.map((row) => row.name).join('، '),
          })}
        </p>
      </form>
    </SectionCard>
  );
}

function OutRow({ template, clause }: { template: number | null; clause: BuilderClause }) {
  const { t } = useTranslation('sales');
  const save = useSaveClause(template);
  const name = clause.title || clause.text.split(/\s+/).slice(0, 8).join(' ');
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 shadow-[inset_0_1px_0_var(--hair)] first:shadow-none">
      <span className="min-w-0 truncate text-sm text-text-2">{name}</span>
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
        {t('manager.builder.clauses.restore', { name })}
      </Button>
    </li>
  );
}
// endregion

// region Prices and rules
function PricesAndRules({ data }: { data: ContractBuilder }) {
  return (
    <>
      <Prices template={data.template.id} prices={data.prices} />
      <Rules template={data.template.id} rules={data.rules} limits={data.limits} />
    </>
  );
}

function Prices({ template, prices }: { template: number | null; prices: BuilderPrice[] }) {
  const { t } = useTranslation('sales');
  const s = useSalesFormat();
  const save = useSavePrices(template);
  // A template may offer a service free (free apply to Turkey); the standard contract may not.
  const free = template !== null;
  const [rows, setRows] = useState(prices);
  const change = (index: number, row: Partial<BuilderPrice>) =>
    setRows(rows.map((item, at) => (at === index ? { ...item, ...row } : item)));
  return (
    <SectionCard
      id="prices"
      variant="panel"
      title={t('manager.builder.prices.title')}
      subtitle={t(free ? 'manager.builder.prices.subtitleFree' : 'manager.builder.prices.subtitle')}
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
              hint={
                row.price
                  ? s.toman(row.price)
                  : free && row.price === 0
                    ? t('manager.builder.prices.free')
                    : t('manager.builder.prices.none')
              }
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
              checked={row.is_active && (free ? row.price !== null : !!row.price)}
              disabled={free ? row.price === null : !row.price}
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

function Rules({
  template,
  rules,
  limits,
}: {
  template: number | null;
  rules: OfferRules;
  limits: RuleLimits;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const save = useSaveRules(template);
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
  // What this kind of contract is limited to (S73): none chosen means all of them.
  const limit = (key: 'countries' | 'degrees') => (
    <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
      <legend className="mb-1 text-[15px] font-medium">{t(`manager.builder.rules.${key}`)}</legend>
      <p className="m-0 text-[13px] text-text-2">
        {form[key].length
          ? t(`manager.builder.rules.${key}Only`, { n: f.number(form[key].length) })
          : t(`manager.builder.rules.${key}All`)}
      </p>
      <div className="flex flex-wrap gap-2">
        {limits[key].map((option) => (
          <TogglePill
            key={option.id}
            label={option.name}
            checked={form[key].includes(option.id)}
            onChange={(on) => set(key, toggle(form[key], option.id, on))}
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
      {limit('countries')}
      {limit('degrees')}
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
function Versions({ data }: { data: ContractBuilder }) {
  const { t } = useTranslation('sales');
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
            <p
              key={change.title + change.text}
              className="m-0 rounded-xl bg-canvas p-3 text-sm leading-7"
            >
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
