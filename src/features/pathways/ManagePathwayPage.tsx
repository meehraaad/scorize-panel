import { useSuspenseQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Choices';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Switch } from '@/components/ui/Switch';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import type { Answers, Factor } from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { idParam } from '@/lib/router/lazyPage';
import { toast } from '@/lib/toast';
import { toLatinDigits } from '@/lib/text';
import {
  usePathwaysPath,
  managedPathwayQuery,
  managedPathwaysQuery,
  type ConditionInput,
  type PathwayDetail,
  type PathwayInput,
  type RequirementInput,
} from './manageApi';
import { STATUS_TONE, emptyInput, inputOf } from './manageForm';
import {
  useCreatePathway,
  useSetCutoff,
  useTryPathway,
  useUpdatePathway,
  useVerifyPathway,
} from './manageMutations';
import type { ParseKeys } from 'i18next';

/** A key built at run time (a question's, a status's): one of this dictionary's. */
const key = (name: string) => name as ParseKeys<'pathways'>;

/** A new route (`…/pathways/new`) or one to edit, check and publish. */
export default function ManagePathwayPage() {
  const id = idParam(useParams().id);
  return id === null ? <Editor detail={null} /> : <Existing id={id} />;
}

function Existing({ id }: { id: number }) {
  const { data } = useSuspenseQuery(managedPathwayQuery(id));
  return <Editor key={data.updated_at} detail={data} />;
}

const blankCondition: ConditionInput = { minimum: '', maximum: '', value: '' };

/** The sample person staff try the rules on, before saving. */
const SAMPLE: Answers = {
  age: 28,
  education: 'bachelor',
  english_ielts: 6.5,
  work_years: 4,
  german_level: 'none',
  recognition: 'partial',
  job_offer: false,
  shortage_occupation: false,
  skills_assessment: false,
  stay_months: 0,
  partner: 'single',
};

/** A whole number typed in Latin or Persian digits, or null when empty. */
const numberOf = (text: string) => {
  const digits = text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '');
  return digits ? Number(digits) : null;
};
const numberText = (value: number | null) => (value === null ? '' : String(value));

/** The requirements by group, in the order the groups first appear, each row with its index in the form. */
function requirementGroups(rows: readonly RequirementInput[]) {
  const groups = new Map<
    number,
    { number: number; rows: { row: RequirementInput; index: number }[] }
  >();
  rows.forEach((row, index) => {
    const group = groups.get(row.group) ?? { number: row.group, rows: [] };
    group.rows.push({ row, index });
    groups.set(row.group, group);
  });
  return [...groups.values()];
}

/** The word between two requirements: «و» between groups (all needed), «یا» inside one (one is enough). */
function Joiner({ label, tone }: { label: string; tone: 'and' | 'or' }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="h-px flex-1 bg-hair" />
      <span
        className={`rounded-full px-3 py-0.5 text-xs font-bold ${
          tone === 'and'
            ? 'bg-primary text-on-primary'
            : 'bg-canvas text-primary-text shadow-[inset_0_0_0_1px_var(--line-2)]'
        }`}
      >
        {label}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-hair" />
    </div>
  );
}

function Editor({ detail }: { detail: PathwayDetail | null }) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const navigate = useNavigate();
  const base = usePathwaysPath();
  const { data: list } = useSuspenseQuery(managedPathwaysQuery);
  const factors = list.factors;
  const [form, setForm] = useState<PathwayInput>(() =>
    detail ? inputOf(detail) : emptyInput(list.countries[0]?.id ?? 0),
  );
  const [errors, setErrors] = useState<Record<string, unknown>>({});
  const create = useCreatePathway();
  const update = useUpdatePathway(detail?.id ?? 0);
  const verify = useVerifyPathway(detail?.id ?? 0);
  const tryRules = useTryPathway();
  const saving = create.isPending || update.isPending;
  const set = <K extends keyof PathwayInput>(key: K, value: PathwayInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const error = (key: string) => {
    const value = errors[key];
    return Array.isArray(value) ? String(value[0]) : undefined;
  };

  const save = () => {
    const onError = (failure: Error) => {
      if (
        failure instanceof ApiError &&
        failure.status === 400 &&
        failure.body &&
        typeof failure.body === 'object'
      ) {
        setErrors(failure.body as Record<string, unknown>);
        toast.error(t('edit.check_fields'));
      } else toast.error(t('error'));
    };
    if (detail)
      update.mutate(form, {
        onSuccess: () => {
          setErrors({});
          toast.success(t('edit.saved'));
        },
        onError,
      });
    else
      create.mutate(form, {
        onSuccess: (saved) => {
          toast.success(t('edit.saved'));
          void navigate(`${base}/${saved.id}`, { replace: true });
        },
        onError,
      });
  };

  const factorOptions = factors.map((factor) => ({
    value: factor.name,
    label: t(key(`factors.${factor.name}`), { defaultValue: factor.name }),
  }));
  const factorOf = (name: string) => factors.find((factor) => factor.name === name);
  const newRequirement = () => ({
    group: 0,
    factor: factors[0]?.name ?? 'age',
    label: '',
    ...blankCondition,
  });
  const usedFactors = [
    ...new Set([...form.requirements.map((r) => r.factor), ...form.criteria.map((c) => c.factor)]),
  ];

  return (
    <PageStack>
      <Link to={base} className="text-sm">
        {t('edit.back')}
      </Link>
      <PageHeader
        title={detail ? form.name_persian || form.name : t('edit.new_title')}
        subtitle={detail ? detail.country.name : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {detail && (
              <Chip tone={STATUS_TONE[detail.status]}>
                {t(key(`manage.status.${detail.status}`))}
              </Chip>
            )}
            <Button variant="outline" onClick={save} disabled={saving}>
              {t('edit.save')}
            </Button>
            {detail && (
              <Button
                onClick={() =>
                  verify.mutate(form.review_by, {
                    onSuccess: () => toast.success(t('edit.published')),
                    onError: () => toast.error(t('edit.verify_failed')),
                  })
                }
                disabled={verify.isPending || detail.status === 'published'}
              >
                {t('edit.verify')}
              </Button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <SectionCard id="pathway-basics" variant="panel" title={t('edit.basics')}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label={t('edit.country')}
                options={list.countries.map((c) => ({ value: String(c.id), label: c.name }))}
                value={String(form.country)}
                onChange={(value) => set('country', Number(value))}
                error={error('country')}
              />
              <SelectField
                label={t('edit.goal')}
                options={(['work', 'study', 'any'] as const).map((value) => ({
                  value,
                  label: t(key(`edit.goals.${value}`)),
                }))}
                value={form.goal}
                onChange={(value) => set('goal', value)}
              />
              <TextField
                label={t('edit.name_persian')}
                value={form.name_persian}
                onChange={(event) => set('name_persian', event.target.value)}
                error={error('name_persian')}
              />
              <TextField
                label={t('edit.name')}
                dir="ltr"
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                error={error('name')}
              />
              <TextField
                label={t('edit.source_url')}
                dir="ltr"
                inputMode="url"
                value={form.source_url}
                onChange={(event) => set('source_url', event.target.value)}
                error={error('source_url')}
              />
              <LazyDatePicker
                label={t('edit.review_by')}
                value={form.review_by ?? ''}
                onChange={(value) => set('review_by', value || null)}
                only="future"
                clearable
              />
            </div>
            <Switch
              label={t('edit.active')}
              checked={form.is_active}
              onChange={(value) => set('is_active', value)}
            />
          </SectionCard>

          <SectionCard
            id="pathway-requirements"
            variant="panel"
            title={t('edit.requirements')}
            subtitle={t('edit.requirements_help')}
          >
            {requirementGroups(form.requirements).map((group, groupIndex) => (
              <Fragment key={group.number}>
                {groupIndex > 0 && <Joiner label={t('edit.and')} tone="and" />}
                <div className="flex flex-col gap-3 rounded-2xl p-3 shadow-[inset_0_0_0_1px_var(--line-2)] lg:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      {t('edit.must', { number: f.number(groupIndex + 1) })}
                    </span>
                    {group.rows.length > 1 && (
                      <Chip tone="info" small>
                        {t('edit.one_is_enough')}
                      </Chip>
                    )}
                  </div>
                  {group.rows.map(({ row, index }, rowIndex) => (
                    <Fragment key={index}>
                      {rowIndex > 0 && <Joiner label={t('edit.or')} tone="or" />}
                      <div className="flex flex-col gap-3 rounded-xl bg-canvas p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <SelectField
                            label={t('edit.factor')}
                            options={factorOptions}
                            value={row.factor}
                            onChange={(factor) =>
                              set(
                                'requirements',
                                form.requirements.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        factor,
                                        ...blankCondition,
                                        per_first: null,
                                        per_more: null,
                                      }
                                    : r,
                                ),
                              )
                            }
                          />
                          <TextField
                            label={t('edit.label')}
                            value={row.label}
                            onChange={(event) =>
                              set(
                                'requirements',
                                form.requirements.map((r, i) =>
                                  i === index ? { ...r, label: event.target.value } : r,
                                ),
                              )
                            }
                          />
                        </div>
                        <ConditionFields
                          factor={factorOf(row.factor)}
                          value={row}
                          onChange={(condition) =>
                            set(
                              'requirements',
                              form.requirements.map((r, i) =>
                                i === index ? { ...r, ...condition } : r,
                              ),
                            )
                          }
                          error={JSON.stringify(errors[`requirements.${index}`] ?? '') || undefined}
                        />
                        {factorOf(row.factor)?.kind === 'number' && (
                          <FamilyFields
                            value={row}
                            onChange={(family) =>
                              set(
                                'requirements',
                                form.requirements.map((r, i) =>
                                  i === index ? { ...r, ...family } : r,
                                ),
                              )
                            }
                          />
                        )}
                        <Button
                          variant="danger"
                          className="self-start"
                          onClick={() =>
                            set(
                              'requirements',
                              form.requirements.filter((_, i) => i !== index),
                            )
                          }
                        >
                          {t('edit.remove')}
                        </Button>
                      </div>
                    </Fragment>
                  ))}
                  <Button
                    variant="outline"
                    className="self-start"
                    onClick={() => {
                      // The new alternative goes right after its group's last one.
                      const after = (group.rows.at(-1)?.index ?? -1) + 1;
                      set('requirements', [
                        ...form.requirements.slice(0, after),
                        { ...newRequirement(), group: group.number },
                        ...form.requirements.slice(after),
                      ]);
                    }}
                  >
                    {t('edit.add_or')}
                  </Button>
                </div>
              </Fragment>
            ))}
            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                set('requirements', [
                  ...form.requirements,
                  {
                    ...newRequirement(),
                    group: Math.max(0, ...form.requirements.map((r) => r.group)) + 1,
                  },
                ])
              }
            >
              {t('edit.add_requirement')}
            </Button>
          </SectionCard>

          <SectionCard
            id="pathway-points"
            variant="panel"
            title={t('edit.points')}
            subtitle={t('edit.points_help')}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label={t('edit.kind')}
                options={(['requirements', 'points'] as const).map((value) => ({
                  value,
                  label: t(key(`edit.kinds.${value}`)),
                }))}
                value={form.kind}
                onChange={(value) => set('kind', value)}
              />
              {form.kind === 'points' && (
                <TextField
                  label={t('edit.pass_mark')}
                  inputMode="numeric"
                  value={form.pass_mark === null ? '' : String(form.pass_mark)}
                  onChange={(event) =>
                    set('pass_mark', event.target.value === '' ? null : Number(event.target.value))
                  }
                  error={error('pass_mark')}
                />
              )}
              {form.kind === 'points' && (
                <SelectField
                  label={t('edit.ranking')}
                  options={(['', 'crs'] as const).map((value) => ({
                    value,
                    label: t(key(`edit.rankings.${value || 'none'}`)),
                  }))}
                  value={form.ranking}
                  onChange={(value) => set('ranking', value)}
                  hint={t('edit.ranking_help')}
                />
              )}
            </div>
            {form.kind === 'points' &&
              form.criteria.map((criterion, index) => {
                const change = (next: Partial<typeof criterion>) =>
                  set(
                    'criteria',
                    form.criteria.map((c, i) => (i === index ? { ...c, ...next } : c)),
                  );
                return (
                  <div key={index} className="flex flex-col gap-3 rounded-xl bg-canvas p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <SelectField
                        label={t('edit.factor')}
                        options={factorOptions}
                        value={criterion.factor}
                        onChange={(factor) =>
                          change({
                            factor,
                            bands: criterion.bands.map((b) => ({ ...b, ...blankCondition })),
                          })
                        }
                      />
                      <TextField
                        label={t('edit.label')}
                        value={criterion.label}
                        onChange={(event) => change({ label: event.target.value })}
                      />
                    </div>
                    {criterion.bands.map((band, bandIndex) => (
                      <div key={bandIndex} className="flex flex-wrap items-end gap-3">
                        <div className="min-w-0 flex-[999_1_320px]">
                          <ConditionFields
                            factor={factorOf(criterion.factor)}
                            value={band}
                            onChange={(condition) =>
                              change({
                                bands: criterion.bands.map((b, i) =>
                                  i === bandIndex ? { ...b, ...condition } : b,
                                ),
                              })
                            }
                            error={
                              JSON.stringify(
                                errors[`criteria.${index}.bands.${bandIndex}`] ?? '',
                              ) || undefined
                            }
                          />
                        </div>
                        <div className="w-28">
                          <TextField
                            label={t('edit.band_points')}
                            inputMode="numeric"
                            value={String(band.points)}
                            onChange={(event) =>
                              change({
                                bands: criterion.bands.map((b, i) =>
                                  i === bandIndex
                                    ? { ...b, points: Number(event.target.value) || 0 }
                                    : b,
                                ),
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="danger"

                          onClick={() =>
                            change({ bands: criterion.bands.filter((_, i) => i !== bandIndex) })
                          }
                        >
                          {t('edit.remove')}
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"

                        onClick={() =>
                          change({ bands: [...criterion.bands, { ...blankCondition, points: 0 }] })
                        }
                      >
                        {t('edit.add_band')}
                      </Button>
                      <Button
                        variant="danger"

                        onClick={() =>
                          set(
                            'criteria',
                            form.criteria.filter((_, i) => i !== index),
                          )
                        }
                      >
                        {t('edit.remove_criterion')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            {form.kind === 'points' && (
              <Button
                variant="outline"
                className="self-start"
                onClick={() =>
                  set('criteria', [
                    ...form.criteria,
                    { factor: factors[0]?.name ?? 'age', label: '', bands: [] },
                  ])
                }
              >
                {t('edit.add_criterion')}
              </Button>
            )}
          </SectionCard>

          <SectionCard id="pathway-customer" variant="panel" title={t('edit.customer')}>
            <TextAreaField
              label={t('edit.summary')}
              value={form.summary}
              onChange={(event) => set('summary', event.target.value)}
            />
            <TextAreaField
              label={t('edit.tip')}
              value={form.tip}
              onChange={(event) => set('tip', event.target.value)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label={t('edit.duration')}
                value={form.duration}
                onChange={(event) => set('duration', event.target.value)}
              />
              <SelectField
                label={t('edit.cost')}
                options={(['', 'low', 'medium', 'high'] as const).map((value) => ({
                  value,
                  label: t(key(`edit.costs.${value || 'none'}`)),
                }))}
                value={form.cost}
                onChange={(value) => set('cost', value)}
              />
            </div>
            <TextAreaField
              label={t('edit.notes')}
              hint={t('edit.notes_help')}
              value={form.notes}
              onChange={(event) => set('notes', event.target.value)}
            />
          </SectionCard>

          {form.goal !== 'work' && (
            <SectionCard
              id="pathway-study"
              variant="panel"
              title={t('edit.study')}
              subtitle={t('edit.study_help')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label={t('edit.currency')}
                  options={(['', 'e', 'u', 'c', 'p'] as const).map((value) => ({
                    value,
                    label: t(key(`edit.currencies.${value || 'none'}`)),
                  }))}
                  value={form.currency}
                  onChange={(value) => set('currency', value)}
                  error={error('currency')}
                />
                <TextField
                  label={t('edit.living_per_year')}
                  inputMode="numeric"
                  value={numberText(form.living_per_year)}
                  onChange={(event) => set('living_per_year', numberOf(event.target.value))}
                  error={error('living_per_year')}
                />
                <TextField
                  label={t('edit.tuition_min')}
                  inputMode="numeric"
                  value={numberText(form.tuition_min)}
                  onChange={(event) => set('tuition_min', numberOf(event.target.value))}
                  error={error('tuition_min')}
                />
                <TextField
                  label={t('edit.tuition_max')}
                  inputMode="numeric"
                  value={numberText(form.tuition_max)}
                  onChange={(event) => set('tuition_max', numberOf(event.target.value))}
                  error={error('tuition_max')}
                />
                <TextField
                  label={t('edit.post_study_visa')}
                  value={form.post_study_visa}
                  onChange={(event) => set('post_study_visa', event.target.value)}
                  error={error('post_study_visa')}
                />
                <TextField
                  label={t('edit.post_study_months')}
                  inputMode="numeric"
                  value={numberText(form.post_study_months)}
                  onChange={(event) => set('post_study_months', numberOf(event.target.value))}
                  error={error('post_study_months')}
                />
              </div>
              <TextAreaField
                label={t('edit.after_study')}
                value={form.after_study}
                onChange={(event) => set('after_study', event.target.value)}
              />
            </SectionCard>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          {detail?.ranking && <CutoffCard detail={detail} />}
          <SectionCard id="pathway-asks" variant="panel" title={t('edit.asks')}>
            <span className="text-sm text-text-2">{t('edit.asks_help')}</span>
            <div className="flex flex-wrap gap-2">
              {usedFactors.map((name) => (
                <Chip key={name} tone="primary" small>
                  {t(key(`factors.${name}`), { defaultValue: name })}
                </Chip>
              ))}
            </div>
          </SectionCard>
          <SectionCard
            id="pathway-try"
            variant="panel"
            title={t('edit.try')}
            subtitle={t('edit.try_person')}
          >
            <Button
              variant="outline"
              onClick={() =>
                tryRules.mutate(
                  { pathway: form, answers: SAMPLE },
                  { onError: () => toast.error(t('edit.check_fields')) },
                )
              }
              disabled={tryRules.isPending}
            >
              {t('edit.try_button')}
            </Button>
            {tryRules.data && (
              <div className="flex flex-col gap-2 text-sm leading-7">
                <Chip
                  tone={
                    tryRules.data.qualifies ? 'good' : tryRules.data.eligible ? 'warn' : 'neutral'
                  }
                >
                  {tryRules.data.qualifies
                    ? t('fit.good')
                    : tryRules.data.eligible
                      ? t('fit.close')
                      : t('fit.not_now')}
                </Chip>
                {tryRules.data.pass_mark !== null && (
                  <span>
                    {t('points', { points: tryRules.data.points, pass: tryRules.data.pass_mark })}
                  </span>
                )}
                {tryRules.data.missing.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard id="pathway-before" variant="panel" title={t('edit.before')}>
            <span className="text-sm leading-7">{t('edit.before_body')}</span>
          </SectionCard>
        </aside>
      </div>
    </PageStack>
  );
}

/**
 * The latest draw of a ranked pool (Canada's Express Entry): its lowest invited score, which customers see beside
 * their own. Saved on its own, after each draw: it is not a rule, so the route stays published.
 */
function CutoffCard({ detail }: { detail: PathwayDetail }) {
  const { t } = useTranslation('pathways');
  const [cutoff, setCutoff] = useState(detail.cutoff === null ? '' : String(detail.cutoff));
  const [day, setDay] = useState(detail.cutoff_on ?? '');
  const save = useSetCutoff(detail.id);
  const score = numberOrNull(cutoff);
  return (
    <SectionCard
      id="pathway-cutoff"
      variant="panel"
      title={t('edit.cutoff')}
      subtitle={t('edit.cutoff_help')}
    >
      <TextField
        label={t('edit.cutoff_score')}
        inputMode="numeric"
        value={cutoff}
        onChange={(event) => setCutoff(event.target.value)}
      />
      <LazyDatePicker
        label={t('edit.cutoff_on')}
        value={day}
        onChange={setDay}
        only="past"
        clearable
      />
      <Button
        variant="outline"
        disabled={save.isPending || (score !== null && !day)}
        onClick={() =>
          save.mutate(
            { cutoff: score, cutoff_on: score === null ? null : day || null },
            {
              onSuccess: () => toast.success(t('edit.cutoff_saved')),
              onError: () => toast.error(t('edit.check_fields')),
            },
          )
        }
      >
        {t('edit.cutoff_save')}
      </Button>
    </SectionCard>
  );
}

/** A number typed in a field, or null when empty. */
const numberOrNull = (text: string) => {
  const value = Number(toLatinDigits(text));
  return text.trim() === '' || !Number.isFinite(value) ? null : value;
};

/**
 * A minimum that rises with the family (Spain's digital nomad visa: +75% of the minimum wage for the first person
 * coming along, +25% for each more). Left empty, it is the same for everyone.
 */
function FamilyFields({
  value,
  onChange,
}: {
  value: Pick<RequirementInput, 'per_first' | 'per_more'>;
  onChange: (value: Pick<RequirementInput, 'per_first' | 'per_more'>) => void;
}) {
  const { t } = useTranslation('pathways');
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-text-2">{t('edit.family_help')}</span>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label={t('edit.per_first')}
          inputMode="decimal"
          value={value.per_first?.toString() ?? ''}
          onChange={(event) => onChange({ ...value, per_first: numberOrNull(event.target.value) })}
        />
        <TextField
          label={t('edit.per_more')}
          inputMode="decimal"
          value={value.per_more?.toString() ?? ''}
          onChange={(event) => onChange({ ...value, per_more: numberOrNull(event.target.value) })}
        />
      </div>
    </div>
  );
}

/** Minimum / maximum for numbers and levels, or one value for yes/no and choices. */
function ConditionFields({
  factor,
  value,
  onChange,
  error,
}: {
  factor: Factor | undefined;
  value: ConditionInput;
  onChange: (value: ConditionInput) => void;
  error?: string | undefined;
}) {
  const { t } = useTranslation('pathways');
  if (!factor) return null;
  const message = error && error !== '""' ? t('edit.condition_error') : undefined;
  const choiceLabel = (choice: string) =>
    t(key(`choices.${factor.name}.${choice}`), { defaultValue: choice });
  if (factor.kind === 'number')
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          label={t('edit.minimum')}
          inputMode="decimal"
          value={value.minimum}
          onChange={(event) => onChange({ ...value, minimum: event.target.value, value: '' })}
          error={message}
        />
        <TextField
          label={t('edit.maximum')}
          hint={t('edit.maximum_help')}
          inputMode="decimal"
          value={value.maximum}
          onChange={(event) => onChange({ ...value, maximum: event.target.value, value: '' })}
        />
      </div>
    );
  if (factor.kind === 'level') {
    const options = [
      { value: '', label: t('edit.any') },
      ...factor.choices.map((choice) => ({ value: choice, label: choiceLabel(choice) })),
    ];
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label={t('edit.minimum')}
          options={options}
          value={value.minimum}
          onChange={(minimum) => onChange({ ...value, minimum, value: '' })}
          error={message}
        />
        <SelectField
          label={t('edit.maximum')}
          hint={t('edit.maximum_help')}
          options={options}
          value={value.maximum}
          onChange={(maximum) => onChange({ ...value, maximum, value: '' })}
        />
      </div>
    );
  }
  const choices = factor.kind === 'yes_no' ? ['yes', 'no'] : factor.choices;
  return (
    <SelectField
      label={t('edit.value')}
      options={[
        { value: '', label: t('edit.pick') },
        ...choices.map((choice) => ({
          value: choice,
          label: factor.kind === 'yes_no' ? t(key(`edit.${choice}`)) : choiceLabel(choice),
        })),
      ]}
      value={value.value}
      onChange={(picked) => onChange({ minimum: '', maximum: '', value: picked })}
      error={message}
    />
  );
}
