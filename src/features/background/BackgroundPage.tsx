import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { LazyDatePicker } from '@/components/ui/LazyDatePicker';
import { Notice } from '@/components/ui/Notice';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import {
  BACKGROUND_DEGREES,
  backgroundQuery,
  useSaveBackground,
  type Background,
  type BackgroundDegree,
  type BackgroundWrite,
} from '@/lib/applicant/journey';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';

/** Django keeps at most this many degrees, and as many exams as there are to pick. */
const MAX_EDUCATIONS = 6;

interface EducationRow {
  degree: BackgroundDegree;
  field: string;
  university: string;
  graduation_year: string;
  gpa: string;
}

interface ExamRow {
  exam: string;
  score: string;
  /** Kept as it was: the form doesn't ask for the date. */
  date: string | null;
  verified: boolean;
}

interface Form {
  city: string;
  birth_date: string;
  work_years: string;
  articles: string;
  educations: EducationRow[];
  exams: ExamRow[];
}

const text = (value: number | null) => (value === null ? '' : String(value));
/** A number typed with Persian or Arabic digits too ("۱۷٫۵"). */
function numberOf(value: string): number | null {
  const latin = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٫,]/g, '.');
  if (!latin) return null;
  const parsed = Number(latin);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formOf(data: Background): Form {
  return {
    city: data.personal.city,
    birth_date: data.personal.birth_date ?? '',
    work_years: data.personal.work_years ? String(data.personal.work_years) : '',
    articles: data.personal.articles ? String(data.personal.articles) : '',
    educations: data.educations.map((item) => ({
      degree: item.degree,
      field: text(item.field),
      university: item.university,
      graduation_year: text(item.graduation_year),
      gpa: item.gpa ? String(item.gpa) : '',
    })),
    exams: data.exams.map((item) => ({
      exam: String(item.exam),
      score: String(item.score),
      date: item.date,
      verified: item.verified,
    })),
  };
}

const emptyEducation = (): EducationRow => ({
  degree: 'bachelor',
  field: '',
  university: '',
  graduation_year: '',
  gpa: '',
});

/**
 * The tablet form of the office, in the panel: personal details, degrees and language exams. The
 * consultant reads it before a session, and the sales team's lead score uses it. Saved whole
 * (degrees and exams are replaced by what is sent). Shape: docs/backend-changes.md H60.
 */
export default function BackgroundPage() {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const { data } = useSuspenseQuery(backgroundQuery);
  const save = useSaveBackground();
  const [form, setForm] = useState(() => formOf(data));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const setEducation = (index: number, change: Partial<EducationRow>) =>
    set(
      'educations',
      form.educations.map((row, at) => (at === index ? { ...row, ...change } : row)),
    );
  const setExam = (index: number, change: Partial<ExamRow>) =>
    set(
      'exams',
      form.exams.map((row, at) => (at === index ? { ...row, ...change } : row)),
    );

  const check = (): [Record<string, string>, BackgroundWrite | null] => {
    const found: Record<string, string> = {};
    const whole = (key: string, value: string) => {
      const parsed = numberOf(value);
      if (parsed === null) return 0;
      if (Number.isNaN(parsed) || parsed < 0 || !Number.isInteger(parsed))
        found[key] = t('background.invalidNumber');
      return parsed;
    };
    const work_years = whole('work_years', form.work_years);
    const articles = whole('articles', form.articles);
    const educations = form.educations.map((row, index) => {
      if (!row.university.trim()) found[`university-${String(index)}`] = t('background.required');
      const gpa = numberOf(row.gpa);
      if (gpa === null) found[`gpa-${String(index)}`] = t('background.required');
      else if (Number.isNaN(gpa) || gpa <= 0 || gpa > 100)
        found[`gpa-${String(index)}`] = t('background.invalidNumber');
      const year = numberOf(row.graduation_year);
      if (year !== null && (Number.isNaN(year) || year < 1300 || year > 2100))
        found[`year-${String(index)}`] = t('background.invalidNumber');
      return {
        degree: row.degree,
        field: row.field ? Number(row.field) : null,
        university: row.university.trim(),
        graduation_year: year,
        gpa: gpa ?? 0,
      };
    });
    const exams = form.exams.map((row, index) => {
      const option = data.exam_options.find((item) => String(item.id) === row.exam);
      const score = numberOf(row.score);
      if (score === null) found[`score-${String(index)}`] = t('background.required');
      else if (option && (Number.isNaN(score) || score < option.min || score > option.max))
        found[`score-${String(index)}`] = t('background.outOfRange', {
          min: f.number(option.min),
          max: f.number(option.max),
        });
      return { exam: Number(row.exam), score: score ?? 0, date: row.date };
    });
    if (Object.keys(found).length) return [found, null];
    return [
      found,
      {
        personal: {
          city: form.city.trim(),
          birth_date: form.birth_date || null,
          work_years,
          articles,
        },
        educations,
        exams,
      },
    ];
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const [found, body] = check();
    setErrors(found);
    if (!body) {
      document.getElementById(`bg-${Object.keys(found)[0] ?? ''}`)?.focus();
      return;
    }
    save.mutate(body, {
      onSuccess: (saved) => {
        setForm(formOf(saved));
        toast.success(t('background.saved'));
      },
      onError: () => toast.error(t('background.error')),
    });
  };

  const usedExams = new Set(form.exams.map((row) => row.exam));
  const freeExam = data.exam_options.find((item) => !usedExams.has(String(item.id)));

  return (
    <PageStack>
      <BackLink to="/">{t('background.back')}</BackLink>
      <PageHeader title={t('background.title')} subtitle={t('background.subtitle')} />
      <Notice tone={data.complete ? 'success' : 'info'}>
        {t(data.complete ? 'background.complete' : 'background.incomplete')}
      </Notice>

      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <SectionCard variant="panel" size="lg" id="bg-personal" title={t('background.personal')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="bg-city"
              label={t('background.city')}
              value={form.city}
              autoComplete="address-level2"
              onChange={(event) => set('city', event.target.value)}
            />
            <LazyDatePicker
              label={t('background.birthDate')}
              value={form.birth_date}
              only="past"
              clearable
              onChange={(value) => set('birth_date', value)}
            />
            <TextField
              id="bg-work_years"
              label={t('background.workYears')}
              inputMode="numeric"
              value={form.work_years}
              error={errors.work_years}
              onChange={(event) => set('work_years', event.target.value)}
            />
            <TextField
              id="bg-articles"
              label={t('background.articles')}
              inputMode="numeric"
              value={form.articles}
              error={errors.articles}
              onChange={(event) => set('articles', event.target.value)}
            />
          </div>
        </SectionCard>

        <SectionCard
          variant="panel"
          size="lg"
          id="bg-educations"
          title={t('background.educations')}
        >
          {form.educations.map((row, index) => (
            <EducationFields
              key={index}
              index={index}
              row={row}
              fields={data.fields}
              errors={errors}
              onChange={(change) => setEducation(index, change)}
              onRemove={() =>
                set(
                  'educations',
                  form.educations.filter((_, at) => at !== index),
                )
              }
            />
          ))}
          {form.educations.length < MAX_EDUCATIONS && (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => set('educations', [...form.educations, emptyEducation()])}
            >
              {t('background.addEducation')}
            </Button>
          )}
        </SectionCard>

        <SectionCard variant="panel" size="lg" id="bg-exams" title={t('background.exams')}>
          {form.exams.length === 0 && (
            <p className="m-0 text-sm leading-7 text-text-2">{t('background.noExams')}</p>
          )}
          {form.exams.map((row, index) => (
            <ExamFields
              key={index}
              index={index}
              row={row}
              options={data.exam_options.filter(
                (item) => String(item.id) === row.exam || !usedExams.has(String(item.id)),
              )}
              error={errors[`score-${String(index)}`]}
              onChange={(change) => setExam(index, change)}
              onRemove={() =>
                set(
                  'exams',
                  form.exams.filter((_, at) => at !== index),
                )
              }
            />
          ))}
          {freeExam && (
            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                set('exams', [
                  ...form.exams,
                  { exam: String(freeExam.id), score: '', date: null, verified: false },
                ])
              }
            >
              {t('background.addExam')}
            </Button>
          )}
        </SectionCard>

        <Button type="submit" disabled={save.isPending} className="self-end max-sm:w-full">
          {save.isPending ? t('background.saving') : t('background.save')}
        </Button>
      </form>
    </PageStack>
  );
}

function EducationFields({
  index,
  row,
  fields,
  errors,
  onChange,
  onRemove,
}: {
  index: number;
  row: EducationRow;
  fields: Background['fields'];
  errors: Record<string, string>;
  onChange: (change: Partial<EducationRow>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const n = f.number(index + 1);
  const key = (name: string) => `${name}-${String(index)}`;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 not-first-of-type:pt-5 not-first-of-type:shadow-[inset_0_1px_0_var(--hair)]">
      <div className="flex items-center justify-between gap-2">
        <legend className="p-0 text-base font-bold">{t('background.education', { n })}</legend>
        <IconButton
          icon="trash"
          tone="danger"
          aria-label={t('background.removeEducation', { n })}
          onClick={onRemove}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('background.degree')}
          value={row.degree}
          options={BACKGROUND_DEGREES.map((value) => ({
            value,
            label: t(`background.degrees.${value}`),
          }))}
          onChange={(degree) => onChange({ degree })}
        />
        <SelectField
          label={t('background.field')}
          value={row.field}
          options={[
            { value: '', label: t('background.noField') },
            ...fields.map((item) => ({ value: String(item.id), label: item.name })),
          ]}
          onChange={(field) => onChange({ field })}
        />
        <TextField
          id={`bg-${key('university')}`}
          label={t('background.university')}
          value={row.university}
          error={errors[key('university')]}
          onChange={(event) => onChange({ university: event.target.value })}
        />
        <TextField
          id={`bg-${key('gpa')}`}
          label={t('background.gpa')}
          hint={t('background.gpaHint')}
          inputMode="decimal"
          value={row.gpa}
          error={errors[key('gpa')]}
          onChange={(event) => onChange({ gpa: event.target.value })}
        />
        <TextField
          id={`bg-${key('year')}`}
          label={t('background.graduationYear')}
          hint={t('background.graduationYearHint')}
          inputMode="numeric"
          value={row.graduation_year}
          error={errors[key('year')]}
          onChange={(event) => onChange({ graduation_year: event.target.value })}
        />
      </div>
    </fieldset>
  );
}

function ExamFields({
  index,
  row,
  options,
  error,
  onChange,
  onRemove,
}: {
  index: number;
  row: ExamRow;
  options: Background['exam_options'];
  error: string | undefined;
  onChange: (change: Partial<ExamRow>) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const n = f.number(index + 1);
  const option = options.find((item) => String(item.id) === row.exam);
  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="min-w-[160px] flex-1">
        <SelectField
          label={t('background.exam')}
          value={row.exam}
          options={options.map((item) => ({ value: String(item.id), label: item.name }))}
          onChange={(exam) => onChange({ exam, verified: false })}
        />
      </div>
      <div className="min-w-[140px] flex-1">
        <TextField
          id={`bg-score-${String(index)}`}
          label={t('background.score')}
          hint={
            option &&
            t('background.scoreHint', { min: f.number(option.min), max: f.number(option.max) })
          }
          inputMode="decimal"
          value={row.score}
          error={error}
          onChange={(event) => onChange({ score: event.target.value, verified: false })}
        />
      </div>
      <div className="flex items-center gap-2 pt-8">
        {row.verified && (
          <Chip tone="good" small>
            {t('background.verified')}
          </Chip>
        )}
        <IconButton
          icon="trash"
          tone="danger"
          aria-label={t('background.removeExam', { n })}
          onClick={onRemove}
        />
      </div>
    </div>
  );
}
