import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinNumber } from '@/lib/text';
import { TURKEY_DEGREES, useStartTurkey, type TurkeyDegree } from '../api';
import { toast } from '@/lib/toast';

const HOW = ['upload', 'review', 'sign'] as const;
type Field = 'field' | 'gpa' | 'start_term';

/** Step 1: what the programme is, and three questions that decide the document list. */
export function StartStep() {
  const { t } = useTranslation('turkey');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const start = useStartTurkey();
  const [degree, setDegree] = useState<TurkeyDegree>(2);
  const [values, setValues] = useState<Record<Field, string>>({
    field: '',
    gpa: '',
    start_term: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const set = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const gpa = Number(toLatinNumber(values.gpa.trim()));
    const found: Partial<Record<Field, string>> = {};
    for (const field of ['field', 'gpa', 'start_term'] as const)
      if (!values[field].trim()) found[field] = t('start.required');
    if (!found.gpa && !(gpa > 0 && gpa <= 20)) found.gpa = t('start.gpaError');
    setErrors(found);
    const first = (['field', 'gpa', 'start_term'] as const).find((field) => found[field]);
    if (first) {
      document.getElementById(`turkey-${first}`)?.focus();
      return;
    }
    start.mutate(
      {
        degree,
        field: values.field.trim(),
        gpa: String(gpa),
        start_term: values.start_term.trim(),
      },
      { onError: () => toast.error(t('start.error')) },
    );
  };

  return (
    <>
      <section
        aria-labelledby="turkey-start-title"
        className="flex flex-col gap-5 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:rounded-[32px] lg:px-10 lg:py-9"
      >
        <div className="flex flex-col gap-2.5">
          <h1
            id="turkey-start-title"
            className="m-0 font-display text-[24px] leading-snug font-bold lg:text-[32px]"
          >
            {t('start.title')}
          </h1>
          <p className="m-0 text-[15px] leading-8 text-on-hero-2">{t('start.text')}</p>
        </div>
        <ol
          aria-label={t('start.how')}
          className="m-0 grid list-none gap-3 p-0 pt-5 shadow-[inset_0_1px_0_var(--hero-line)] sm:grid-cols-3"
        >
          {HOW.map((step, index) => (
            <li key={step} className="flex flex-col gap-1.5 rounded-[18px] bg-hero-raised p-4">
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full bg-on-hero text-sm font-bold text-hero"
              >
                {f.number(index + 1)}
              </span>
              <span className="text-[15px] font-semibold">{t(`start.howStep.${step}.title`)}</span>
              <span className="text-[13px] leading-6 text-on-hero-2">
                {t(`start.howStep.${step}.text`)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <SectionCard
        variant="panel"
        size="lg"
        id="turkey-questions"
        title={t('start.form')}
        subtitle={t('start.formText')}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-5">
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="pb-2.5 text-[15px] font-medium">{t('start.degree')}</legend>
            <div className="flex gap-1.5 rounded-full bg-canvas p-1 shadow-[inset_0_0_0_1px_var(--line-2)]">
              {TURKEY_DEGREES.map((item) => (
                <label
                  key={item}
                  className="flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-2 text-center text-sm font-semibold text-text-2 has-checked:bg-surface has-checked:text-text has-checked:shadow-panel has-focus-visible:outline-2 has-focus-visible:outline-focus"
                >
                  <input
                    type="radio"
                    name="turkey-degree"
                    value={item}
                    checked={degree === item}
                    onChange={() => setDegree(item)}
                    className="sr-only"
                  />
                  {tc(`degree.${item}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="turkey-field"
              label={t('start.field')}
              value={values.field}
              error={errors.field}
              onChange={(event) => set('field', event.target.value)}
            />
            <TextField
              id="turkey-gpa"
              label={t('start.gpa')}
              inputMode="decimal"
              hint={t('start.gpaHint')}
              value={values.gpa}
              error={errors.gpa}
              onChange={(event) => set('gpa', event.target.value)}
            />
            <TextField
              id="turkey-start_term"
              label={t('start.term')}
              hint={t('start.termHint')}
              value={values.start_term}
              error={errors.start_term}
              onChange={(event) => set('start_term', event.target.value)}
            />
          </div>
          <Button type="submit" size="lg" disabled={start.isPending} className="sm:self-start">
            {start.isPending ? t('start.sending') : t('start.submit')}
          </Button>
        </form>
      </SectionCard>
    </>
  );
}
