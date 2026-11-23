import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChoiceGroup } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar, StepDot } from '@/components/ui/Progress';
import { SaveBar } from '@/components/ui/SaveBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { SuggestField } from '@/components/ui/SuggestField';
import { TextAreaField, TextField } from '@/components/ui/TextField';
import { fieldErrors } from '@/lib/api/fieldErrors';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Facts } from '../components/Facts';
import { dayOf } from '../format';
import {
  majorsQuery,
  type Onboarding,
  type OnboardingAnswers,
  type OnboardingFileKind,
  type OnboardingStatus,
} from './api';
import { myOnboardingQuery } from './me';
import { AnswersSummary } from './components/AnswersSummary';
import { STATUS_TONE } from './status';
import { DocumentsSection } from './components/DocumentsSection';
import {
  EDUCATIONS,
  EMPTY_ANSWERS,
  FIELDS,
  FILE_KINDS,
  GENDERS,
  MARITAL,
  MILITARY,
  MAX_AGE,
  MAX_CHILDREN,
  MIN_AGE,
  SECTIONS,
  checkAnswers,
  fileKey,
  isAsked,
  sectionProgress,
  yearsAgo,
  type FieldKey,
  type FieldSpec,
  type Problem,
} from './fields';
import { isGone, useSaveDraft, useSubmitOnboarding } from './mutations';

/** Wait this long after the last keystroke before saving the draft. */
const DRAFT_DELAY_MS = 1200;
/** A field being typed in shows its problem only once typing pauses this long. */
const PROBLEM_DELAY_MS = 600;

const AUTOCOMPLETE: Partial<Record<FieldKey, string>> = {
  first_name: 'given-name',
  last_name: 'family-name',
  email: 'email',
  address: 'street-address',
};
const INPUT_MODE: Partial<Record<FieldKey, 'numeric' | 'tel' | 'email'>> = {
  national_code: 'numeric',
  id_number: 'numeric',
  emergency_phone: 'tel',
  email: 'email',
};

/**
 * `/me/onboarding`: the new hire's personal details form (replaces the Porsline link HR used to
 * send). Open (`draft`, `returned`): the form, saved as a draft while typing; sent: what was sent
 * and where it stands.
 */
export default function OnboardingPage() {
  const { t } = useTranslation('hr');
  const { data } = useSuspenseQuery(myOnboardingQuery);
  if (!data)
    return (
      <PageStack>
        <PageHeader title={t('onboarding.title')} />
        <EmptyState variant="card" icon="check">
          {t('onboarding.none')}
        </EmptyState>
      </PageStack>
    );
  if (data.status === 'draft' || data.status === 'returned') return <OnboardingForm form={data} />;
  return <SentForm form={data} />;
}

function StatusChip({ status }: { status: OnboardingStatus }) {
  const { t } = useTranslation('hr');
  return (
    <Chip tone={STATUS_TONE[status]} small dot>
      {t(`onboarding.status.${status}`)}
    </Chip>
  );
}

/** After sending: where it stands, and the answers. */
function SentForm({ form }: { form: Onboarding }) {
  const { t } = useTranslation('hr');
  return (
    <PageStack>
      <PageHeader title={t('onboarding.title')} subtitle={<StatusChip status={form.status} />} />
      {form.status !== 'cancelled' && (
        <Notice tone={form.status === 'approved' ? 'success' : 'info'}>
          {t(form.status === 'approved' ? 'onboarding.approvedText' : 'onboarding.submittedText')}
        </Notice>
      )}
      <AnswersSummary answers={form.answers} files={form.files} />
    </PageStack>
  );
}

const initialAnswers = (form: Onboarding): OnboardingAnswers => ({
  ...EMPTY_ANSWERS,
  ...form.answers,
  // A stepper always shows a number: zero children until told otherwise.
  number_of_children: form.answers.number_of_children ?? 0,
});

const focusField = (id: string) => {
  const target = document.getElementById(id);
  target?.focus();
  target?.scrollIntoView({ block: 'center' });
};

function OnboardingForm({ form }: { form: Onboarding }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const save = useSaveDraft();
  const submit = useSubmitOnboarding();
  // `disabled` comes with the next render: a quick second click must not send it twice.
  const sendingRef = useRef(false);
  const [answers, setAnswers] = useState(() => initialAnswers(form));
  const [savedBody, setSavedBody] = useState(() => JSON.stringify(form.answers));
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  /** The field typed in last, until it is left: its problem waits for a pause. */
  const [editing, setEditing] = useState<FieldKey | null>(null);

  const { problems } = useMemo(
    () => checkAnswers(answers, form.files, attempted),
    [answers, form.files, attempted],
  );
  const paused = useDebouncedValue(answers, PROBLEM_DELAY_MS);
  const pausedProblems = useMemo(
    () => checkAnswers(paused, form.files, attempted).problems,
    [paused, form.files, attempted],
  );
  const body = JSON.stringify(answers);
  const dirty = body !== savedBody;

  // The draft follows the typing: saved once it pauses.
  const settled = useDebouncedValue(answers, DRAFT_DELAY_MS);
  const saveDraft = save.mutate;
  const sending = submit.isPending;
  useEffect(() => {
    const next = JSON.stringify(settled);
    if (next === savedBody || sending) return;
    saveDraft(settled, { onSuccess: () => setSavedBody(next) });
  }, [settled, savedBody, sending, saveDraft]);

  const set = <K extends FieldKey>(key: K, value: OnboardingAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setEditing(key);
    if (serverErrors[key]) setServerErrors(({ [key]: _gone, ...rest }) => rest);
  };
  const touch = (key: FieldKey) => {
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
    setEditing((current) => (current === key ? null : current));
  };
  const errorOf = (key: FieldKey): string | undefined => {
    if (serverErrors[key]) return serverErrors[key];
    // While typing (an IBAN, a national code), only once it pauses: not at every keystroke. A
    // value made right clears its error at once.
    const problem: Problem | undefined =
      editing === key && !pausedProblems[key] ? undefined : problems[key];
    if (!problem) return undefined;
    return attempted || touched.has(key) ? t(`onboarding.problem.${problem}`) : undefined;
  };
  // A missing document: under its own kind, after a send (Django's one `files` error goes under
  // each kind still missing).
  const fileErrors = Object.fromEntries(
    FILE_KINDS.map((kind) => {
      const missing = !form.files.some((file) => file.kind === kind);
      const error =
        (missing && serverErrors.files) ||
        (attempted && problems[fileKey(kind)] ? t('onboarding.problem.file') : undefined);
      return [kind, error];
    }),
  ) as Record<OnboardingFileKind, string | undefined>;

  const progress = SECTIONS.map((section) => sectionProgress(section, answers, form.files));
  const complete = progress.filter(({ done, total }) => done === total).length;

  const send = () => {
    if (sendingRef.current) return;
    setAttempted(true);
    const checked = checkAnswers(answers, form.files, true);
    const first = FIELDS.find((field) => checked.problems[field.key]);
    const missing = FILE_KINDS.find((kind) => checked.problems[fileKey(kind)]);
    if (first || missing) {
      focusField(first ? `onb-${first.key}` : `onb-files-${missing ?? ''}`);
      return;
    }
    // Sent, the form gives way to the summary: `mutateAsync` still reports after it unmounts
    // (a callback passed to `mutate` would be dropped).
    sendingRef.current = true;
    void submit.mutateAsync(checked.answers).then(
      () => {
        sendingRef.current = false;
        toast.success(t('onboarding.submitted'));
        window.scrollTo({ top: 0 });
      },
      (error: unknown) => {
        sendingRef.current = false;
        // Sent or cancelled meanwhile: the mutation says so and the page catches up.
        if (isGone(error)) return;
        const fields = fieldErrors(error);
        setServerErrors(fields);
        const bad = FIELDS.find((field) => fields[field.key]);
        if (bad) focusField(`onb-${bad.key}`);
        else if (fields.files) {
          // Django names no kind: the page knows which one is missing.
          const kind = FILE_KINDS.find((one) => !form.files.some((file) => file.kind === one));
          focusField(`onb-files-${kind ?? 'birth_certificate'}`);
        } else toast.error(t('error'));
      },
    );
  };

  const draftMessage = save.isPending
    ? t('onboarding.draft.saving')
    : save.isError && dirty
      ? t('onboarding.draft.failed')
      : dirty
        ? t('onboarding.draft.unsaved')
        : t('onboarding.draft.saved');

  const main = (
    <>
      {form.status === 'returned' && form.note && (
        <Notice tone="warn">{t('onboarding.returnedNote', { note: form.note })}</Notice>
      )}
      <Card className="flex flex-col gap-3 p-5 lg:p-7">
        <ProgressBar
          value={Math.round((complete / SECTIONS.length) * 100)}
          tone={complete === SECTIONS.length ? 'good' : 'primary'}
          label={t('onboarding.progress', {
            done: f.number(complete),
            total: f.number(SECTIONS.length),
          })}
        />
        <span className="text-small text-text-2">
          {t('onboarding.progress', { done: f.number(complete), total: f.number(SECTIONS.length) })}
          {form.due && ` · ${t('onboarding.due', { day: f.date(dayOf(form.due)) })}`}
        </span>
      </Card>
      {SECTIONS.filter((section) => section !== 'documents').map((section) => (
        <SectionCard
          key={section}
          id={`onb-section-${section}`}
          variant="panel"
          title={t(`onboarding.section.${section}`)}
          subtitle={t(`onboarding.sectionHint.${section}`)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.filter((field) => field.section === section && isAsked(field.key, answers)).map(
              (field) => (
                <Field
                  key={field.key}
                  field={field}
                  answers={answers}
                  error={errorOf(field.key)}
                  onChange={set}
                  onBlur={() => touch(field.key)}
                />
              ),
            )}
          </div>
        </SectionCard>
      ))}
      <DocumentsSection files={form.files} errors={fileErrors} />
      {attempted && Object.keys(problems).length > 0 && (
        <Notice tone="warn">{t('onboarding.fix')}</Notice>
      )}
      <SaveBar message={draftMessage} dirty={dirty}>
        {save.isError && dirty && (
          <Button
            variant="outline"
            onClick={() => saveDraft(answers, { onSuccess: () => setSavedBody(body) })}
          >
            {t('onboarding.draft.retry')}
          </Button>
        )}
        <Button disabled={sending} onClick={send}>
          {t('onboarding.submit')}
        </Button>
      </SaveBar>
    </>
  );

  const aside = (
    <>
      <Card className="flex flex-col gap-1 p-5">
        <h2 className="m-0 text-section font-bold">{t('onboarding.sections')}</h2>
        <ol aria-label={t('onboarding.sections')} className="m-0 flex list-none flex-col p-0">
          {SECTIONS.map((section, index) => {
            const { done, total } = progress[index] ?? { done: 0, total: 0 };
            return (
              <li key={section}>
                <a
                  href={`#onb-section-${section}`}
                  className="flex min-h-tap items-center gap-2.5 rounded-xl px-2 text-small text-text hover:bg-canvas"
                >
                  <StepDot
                    number={f.number(index + 1)}
                    state={done === total ? 'done' : done > 0 ? 'current' : 'todo'}
                    size="xs"
                  />
                  {t(`onboarding.section.${section}`)}
                </a>
              </li>
            );
          })}
        </ol>
      </Card>
      <SectionCard
        id="onb-fixed"
        title={t('onboarding.fixed.title')}
        subtitle={t('onboarding.fixed.hint')}
      >
        <Facts
          label={t('onboarding.fixed.title')}
          rows={[
            [t('onboarding.fixed.phone'), <bdi dir="ltr">{f.digits(form.fixed.phone_number)}</bdi>],
          ]}
        />
      </SectionCard>
    </>
  );

  return (
    <PageStack>
      <PageHeader
        title={t('onboarding.title')}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t('onboarding.subtitle')}</span>
            <StatusChip status={form.status} />
          </span>
        }
      />
      <PageColumns
        main={main}
        aside={aside}
        asideLabel={t('onboarding.sections')}
        asideWidth="sm"
      />
    </PageStack>
  );
}

/** One answer, drawn by its kind; `onb-<key>` takes the focus when it needs fixing. */
function Field({
  field,
  answers,
  error,
  onChange,
  onBlur,
}: {
  field: FieldSpec;
  answers: OnboardingAnswers;
  error: string | undefined;
  onChange: <K extends FieldKey>(key: K, value: OnboardingAnswers[K]) => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation('hr');
  const { key } = field;
  const id = `onb-${key}`;
  const label = t(`onboarding.field.${key}`);
  const hint = hintOf(key, t);

  if (field.kind === 'date')
    return (
      <Focusable id={id} error={undefined}>
        <DatePicker
          label={label}
          value={(answers[key] as string | null) ?? ''}
          onChange={(value) => onChange(key, value || null)}
          min={yearsAgo(MAX_AGE)}
          max={yearsAgo(MIN_AGE)}
          // Open on the years around 30 years ago.
          openOn={yearsAgo(30)}
          openView="years"
          hint={hint}
          error={error}
        />
      </Focusable>
    );

  if (field.kind === 'number')
    return (
      <div className="flex flex-col gap-2">
        <span className="text-body font-medium">{label}</span>
        <NumberStepper
          label={label}
          value={answers.number_of_children ?? 0}
          onChange={(value) => onChange('number_of_children', value)}
          min={0}
          max={MAX_CHILDREN}
          fill
          decreaseLabel={t('onboarding.fewer')}
          increaseLabel={t('onboarding.more')}
        />
        {hint && <span className="text-small text-text-2">{hint}</span>}
      </div>
    );

  if (field.kind === 'choice') {
    const choice = (
      {
        gender: {
          values: GENDERS,
          look: 'pills',
          label: (v: string) => t(`onboarding.gender.${v as (typeof GENDERS)[number]}`),
        },
        marital_status: {
          values: MARITAL,
          look: 'pills',
          label: (v: string) => t(`marital.${v as (typeof MARITAL)[number]}`),
        },
        education: {
          values: EDUCATIONS,
          look: 'chips',
          label: (v: string) => t(`onboarding.education.${v as (typeof EDUCATIONS)[number]}`),
        },
        military_status: {
          values: MILITARY,
          look: 'chips',
          label: (v: string) => t(`onboarding.military.${v as (typeof MILITARY)[number]}`),
        },
      } as const
    )[key as 'gender' | 'marital_status' | 'education' | 'military_status'];
    return (
      <Focusable id={id} error={error} wide={choice.look === 'chips'}>
        <ChoiceGroup<string>
          legend={label}
          look={choice.look}
          value={(answers[key] as string | null) ?? null}
          onChange={(value) => onChange(key, value as OnboardingAnswers[typeof key])}
          options={choice.values.map((value) => ({ value, label: choice.label(value) }))}
        />
      </Focusable>
    );
  }

  const value = (answers[key] as string | null) ?? '';
  const change = (next: string) => onChange(key, next as OnboardingAnswers[typeof key]);
  if (key === 'field_of_study')
    return (
      <MajorField
        id={id}
        label={label}
        value={value}
        max={field.max}
        error={error}
        onValue={change}
        onBlur={onBlur}
      />
    );
  if (field.kind === 'longtext')
    return (
      <div className="sm:col-span-2">
        <TextAreaField
          id={id}
          label={label}
          value={value}
          rows={3}
          maxLength={field.max}
          autoComplete={AUTOCOMPLETE[key]}
          error={error}
          onChange={(event) => change(event.target.value)}
          onBlur={onBlur}
        />
      </div>
    );
  return (
    <TextField
      id={id}
      label={label}
      hint={hint}
      error={error}
      value={value}
      dir={field.ltr ? 'ltr' : undefined}
      // Typed left to right (numbers, the IBAN, email): Persian digits become Latin as typed.
      latinDigits={field.ltr === true}
      inputMode={INPUT_MODE[key]}
      autoComplete={AUTOCOMPLETE[key] ?? 'off'}
      maxLength={field.max}
      onChange={(event) => change(event.target.value)}
      onBlur={onBlur}
    />
  );
}

/** The major, typed freely, with the site's majors suggested once typing pauses. */
function MajorField({
  id,
  label,
  value,
  max,
  error,
  onValue,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  max: number | undefined;
  error: string | undefined;
  onValue: (value: string) => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation('hr');
  const search = useDebouncedValue(value.trim());
  const majors = useQuery({ ...majorsQuery(search), enabled: search.length >= 2 });
  return (
    <SuggestField
      id={id}
      label={label}
      hint={t('onboarding.hint.field_of_study')}
      value={value}
      maxLength={max}
      error={error}
      onValue={onValue}
      onBlur={onBlur}
      suggestions={search === value.trim() ? (majors.data ?? []).slice(0, 8) : []}
      listLabel={t('onboarding.majors')}
    />
  );
}

function hintOf(key: FieldKey, t: ReturnType<typeof useTranslation<'hr'>>['t']) {
  switch (key) {
    case 'preferred_name':
    case 'first_name_en':
    case 'national_code':
    case 'id_number':
    case 'birth_date':
    case 'iban':
    case 'email':
    case 'number_of_children':
      return t(`onboarding.hint.${key}`);
    default:
      return undefined;
  }
}

/** A group (choices, a date) that can take the focus as a whole, with its error under it. */
function Focusable({
  id,
  error,
  wide = false,
  children,
}: {
  id: string;
  error: string | undefined;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      tabIndex={-1}
      className={`flex flex-col gap-2 rounded-2xl outline-none focus-visible:outline-2 focus-visible:outline-focus ${wide ? 'sm:col-span-2' : ''}`}
    >
      {children}
      {error && <p className="m-0 text-small text-danger">{error}</p>}
    </div>
  );
}
