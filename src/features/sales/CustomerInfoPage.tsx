import { useSuspenseQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { PageColumns } from '@/components/ui/PageColumns';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { safeHref } from '@/lib/url';
import {
  CHOICES,
  UnknownNameError,
  infoQuery,
  type CustomerInfo,
  type EducationEntry,
  type ExamEntry,
  type Option,
} from './api';
import { customerPath } from './paths';
import { useCustomerId } from './useCustomerId';
import { useInfoAutosave, type InfoDraft, type SectionName } from './useInfoAutosave';

const AutosaveContext = createContext<ReturnType<typeof useInfoAutosave> | null>(null);
function useAutosave() {
  const value = useContext(AutosaveContext);
  if (!value) throw new Error('Missing customer autosave provider');
  return value;
}

const PERSONAL_TEXT = ['first_name', 'last_name', 'father_name', 'city', 'work_years'] as const;
const PERSONAL_CHOICE = ['gender', 'marital', 'military'] as const;
type ChoiceKey = (typeof PERSONAL_CHOICE)[number] | 'budget';

/** A model choice's options (Django's codes), labelled from the dictionary. */
function useChoices() {
  const { t } = useTranslation('sales');
  const { t: tc } = useTranslation('common');
  const empty = { value: '', label: t('info.choose') };
  const options: Record<ChoiceKey, Option[]> = {
    gender: CHOICES.gender.map((code) => ({
      value: String(code),
      label: t(`info.choice.gender.${code}`),
    })),
    marital: CHOICES.marital.map((code) => ({
      value: String(code),
      label: t(`info.choice.marital.${code}`),
    })),
    military: CHOICES.military.map((code) => ({
      value: String(code),
      label: t(`info.choice.military.${code}`),
    })),
    budget: CHOICES.budget.map((code) => ({
      value: String(code),
      label: t(`info.choice.budget.${code}`),
    })),
  };
  return {
    of: (key: ChoiceKey) => [empty, ...options[key]],
    degree: [
      empty,
      ...CHOICES.degree.map((code) => ({ value: String(code), label: tc(`degree.${code}`) })),
    ],
    list: (list: Option[]) => [empty, ...list],
  };
}

/**
 * The customer's details, editable by the seller section by section (the forms of crm
 * user_detail: personal information, user info, education degrees, exam scores).
 */
export default function CustomerInfoPage() {
  const id = useCustomerId();
  const { data } = useSuspenseQuery(infoQuery(id));
  return <CustomerInfoEditor key={id} id={id} initial={data} />;
}

function CustomerInfoEditor({ id, initial }: { id: number; initial: CustomerInfo }) {
  const { t } = useTranslation('sales');
  const autosave = useInfoAutosave(id, initial);
  const { draft: data, blocker } = autosave;
  return (
    <AutosaveContext value={autosave}>
      <PageColumns
        asideLabel={t('info.aside')}
        main={
          <>
            <PersonalCard />
            <GoalCard />
            <EducationCard />
            <ExamsCard />
          </>
        }
        aside={
          <>
            <SectionCard id="info-tablet" variant="panel" title={t('info.tablet.title')}>
              <p className="m-0 text-sm leading-7 text-neutral">{t('info.tablet.text')}</p>
              <a
                href={safeHref(data.tablet_url)}
                target="_blank"
                rel="noreferrer"
                className={buttonClass('outline', 'self-start')}
              >
                {t('info.tablet.open')}
              </a>
            </SectionCard>
            <SectionCard id="info-similar" variant="panel" title={t('info.similar.title')}>
              <p className="m-0 text-sm leading-7 text-neutral">{t('info.similar.text')}</p>
              <Link to={customerPath(id)} className="text-sm text-primary-text">
                {t('info.similar.link')}
              </Link>
            </SectionCard>
          </>
        }
      />
      <Dialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
        title={t('info.autosave.leaveTitle')}
        closeLabel={t('info.autosave.stay')}
      >
        <p>{t('info.autosave.leaveText')}</p>
        <Button onClick={() => blocker.state === 'blocked' && blocker.reset()}>
          {t('info.autosave.stay')}
        </Button>
        <Button
          variant="outline"
          disabled={autosave.saving}
          onClick={() => blocker.state === 'blocked' && blocker.proceed()}
        >
          {t('info.autosave.leave')}
        </Button>
      </Dialog>
    </AutosaveContext>
  );
}

/** A section of the details: its own form, saved on its own. */
function InfoForm({
  id,
  title,
  end,
  section,
  children,
}: {
  id: string;
  title: string;
  end?: ReactNode;
  section: SectionName;
  children: ReactNode;
}) {
  const { t } = useTranslation('sales');
  const autosave = useAutosave();
  const state = autosave.statuses[section];
  const error = autosave.errors[section];
  return (
    <SectionCard id={id} variant="panel" size="lg" title={title} end={end}>
      <form
        aria-describedby={`${id}-save-status`}
        onSubmit={(event) => {
          event.preventDefault();
          autosave.retry(section);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) void autosave.flush();
        }}
        className="flex flex-col gap-4"
      >
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <span
            id={`${id}-save-status`}
            role="status"
            aria-live="polite"
            className={
              state === 'error' || state === 'incomplete'
                ? 'text-sm text-danger'
                : 'text-sm text-text-2'
            }
          >
            {state === 'error' && error instanceof UnknownNameError
              ? t('info.notFound', { value: error.value })
              : t(`info.autosave.${state}`)}
          </span>
          {state === 'error' && (
            <Button variant="outline" type="submit">
              {t('info.autosave.retry')}
            </Button>
          )}
        </div>
      </form>
    </SectionCard>
  );
}

function PersonalCard() {
  const { draft: info, update } = useAutosave();
  const { t } = useTranslation('sales');
  const choices = useChoices();
  const form = info.personal;
  const set = (key: keyof CustomerInfo['personal']) => (value: string) =>
    update('personal', { ...form, [key]: value });
  return (
    <InfoForm id="info-personal" title={t('info.personal.title')} section="personal">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PERSONAL_TEXT.map((key) => (
          <TextField
            key={key}
            label={t(`info.personal.${key}`)}
            value={form[key]}
            onChange={(event) => set(key)(event.target.value)}
          />
        ))}
        <DatePicker
          only="past"
          clearable
          label={t('info.personal.birth_date')}
          value={form.birth_date}
          onChange={set('birth_date')}
        />
        {PERSONAL_CHOICE.map((key) => (
          <SelectField
            key={key}
            label={t(`info.personal.${key}`)}
            value={form[key]}
            onChange={set(key)}
            options={choices.of(key)}
          />
        ))}
      </div>
    </InfoForm>
  );
}

function GoalCard() {
  const { draft: info, update } = useAutosave();
  const { t } = useTranslation('sales');
  const choices = useChoices();
  const form = info.goal;
  const set = (key: keyof CustomerInfo['goal']) => (value: string) =>
    update('goal', { ...form, [key]: value });
  return (
    <InfoForm id="info-goal" title={t('info.goal.title')} section="goal">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('info.goal.wanted_degree')}
          value={form.wanted_degree}
          onChange={set('wanted_degree')}
          options={choices.degree}
        />
        <SelectField
          label={t('info.goal.budget')}
          value={form.budget}
          onChange={set('budget')}
          options={choices.of('budget')}
        />
        <TextField
          label={t('info.goal.countries')}
          hint={t('info.goal.countriesHint')}
          value={form.countries}
          onChange={(event) => set('countries')(event.target.value)}
        />
        <TextField
          label={t('info.goal.language')}
          value={form.language}
          onChange={(event) => set('language')(event.target.value)}
        />
      </div>
    </InfoForm>
  );
}

/** An editable list (degrees, exams): rows of fields with remove, and "add". */
function useRows<K extends 'education' | 'exams'>(key: K, blank: EducationEntry | ExamEntry) {
  const { draft, update } = useAutosave();
  const rows = draft[key];
  return {
    rows,
    add: () => update(key, [...rows, { ...blank, localId: crypto.randomUUID() }] as InfoDraft[K]),
    remove: (index: number) => update(key, rows.filter((_, at) => at !== index) as InfoDraft[K]),
    set: (index: number, change: Partial<EducationEntry | ExamEntry>) =>
      update(
        key,
        rows.map((row, at) => (at === index ? { ...row, ...change } : row)) as InfoDraft[K],
      ),
  };
}

function EducationCard() {
  const { t } = useTranslation('sales');
  const choices = useChoices();
  const list = useRows('education', {
    degree: '',
    field: '',
    university: '',
    gpa: '',
  });
  return (
    <InfoForm
      id="info-education"
      title={t('info.education.title')}
      section="education"
      end={
        <Button variant="outline" className="h-11 px-4 text-sm" onClick={list.add}>
          <Icon name="plus" size={16} />
          {t('info.education.add')}
        </Button>
      }
    >
      {list.rows.map((row, index) => (
        <fieldset
          key={row.localId}
          className="m-0 grid items-end gap-3 rounded-2xl border-0 bg-canvas p-4 sm:grid-cols-[1fr_1fr_1fr_100px_auto]"
        >
          <legend className="sr-only">{t('info.education.row', { n: String(index + 1) })}</legend>
          <SelectField
            label={t('info.education.degree')}
            value={row.degree}
            onChange={(degree) => list.set(index, { degree })}
            options={choices.degree}
          />
          <TextField
            label={t('info.education.field')}
            value={row.field}
            onChange={(event) => list.set(index, { field: event.target.value })}
          />
          <TextField
            label={t('info.education.university')}
            value={row.university}
            onChange={(event) => list.set(index, { university: event.target.value })}
          />
          <TextField
            label={t('info.education.gpa')}
            value={row.gpa}
            inputMode="decimal"
            onChange={(event) => list.set(index, { gpa: event.target.value })}
          />
          <IconButton
            icon="trash"
            tone="danger"
            aria-label={t('info.education.remove', { n: String(index + 1) })}
            onClick={() => list.remove(index)}
          />
        </fieldset>
      ))}
    </InfoForm>
  );
}

function ExamsCard() {
  const { draft: info } = useAutosave();
  const { t } = useTranslation('sales');
  const choices = useChoices();
  const list = useRows('exams', { exam: '', score: '', date: '' });
  return (
    <InfoForm
      id="info-exams"
      title={t('info.exams.title')}
      section="exams"
      end={
        <Button variant="outline" className="h-11 px-4 text-sm" onClick={list.add}>
          <Icon name="plus" size={16} />
          {t('info.exams.add')}
        </Button>
      }
    >
      {list.rows.map((row, index) => (
        <fieldset
          key={row.localId}
          className="m-0 grid items-end gap-3 rounded-2xl border-0 bg-canvas p-4 sm:grid-cols-[1fr_120px_1fr_auto]"
        >
          <legend className="sr-only">{t('info.exams.row', { n: String(index + 1) })}</legend>
          <SelectField
            label={t('info.exams.exam')}
            value={row.exam}
            onChange={(exam) => list.set(index, { exam })}
            options={choices.list(info.exams_list)}
          />
          <TextField
            label={t('info.exams.score')}
            value={row.score}
            dir="ltr"
            inputMode="decimal"
            onChange={(event) => list.set(index, { score: event.target.value })}
          />
          <DatePicker
            only="past"
            clearable
            label={t('info.exams.date')}
            value={row.date}
            onChange={(date) => list.set(index, { date })}
          />
          <IconButton
            icon="trash"
            tone="danger"
            aria-label={t('info.exams.remove', { n: String(index + 1) })}
            onClick={() => list.remove(index)}
          />
        </fieldset>
      ))}
    </InfoForm>
  );
}
