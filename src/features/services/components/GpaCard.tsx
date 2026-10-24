import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { toLatinNumber } from '@/lib/text';
import { useSaveGpa, type GpaCourse, type ServicesData } from '../api';

interface Row {
  key: number;
  name: string;
  credits: string;
  grade: string;
}

const COLUMNS = 'sm:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_44px]';
let nextKey = 0;
const row = (course?: GpaCourse): Row => ({
  key: nextKey++,
  name: course?.name ?? '',
  credits: course ? String(course.credits) : '',
  grade: course ? String(course.grade) : '',
});

/** A course as numbers, or null when something is missing or out of range. */
function parse(item: Row): GpaCourse | null {
  const credits = Number(toLatinNumber(item.credits.trim()));
  const grade = Number(toLatinNumber(item.grade.trim()));
  if (!item.name.trim() || !item.credits.trim() || !item.grade.trim()) return null;
  if (!Number.isInteger(credits) || credits < 1 || credits > 10) return null;
  if (!(grade >= 0 && grade <= 20)) return null;
  return { name: item.name.trim(), credits, grade };
}

/**
 * The GPA calculator: courses with credits and grades (out of 20). The server converts them (the
 * method universities use) and keeps the list for next time.
 */
export function GpaCard({ data }: { data: ServicesData }) {
  const { t } = useTranslation('services');
  const f = useFormat();
  const save = useSaveGpa();
  const [rows, setRows] = useState<Row[]>(() =>
    data.gpa.courses.length > 0 ? data.gpa.courses.map(row) : [row()],
  );
  const [invalid, setInvalid] = useState(false);
  const credits = rows.reduce((sum, item) => sum + (parse(item)?.credits ?? 0), 0);

  const update = (key: number, field: 'name' | 'credits' | 'grade', value: string) => {
    setInvalid(false);
    setRows((current) =>
      current.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    );
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const courses = rows.map(parse);
    if (courses.some((course) => course === null)) {
      setInvalid(true);
      return;
    }
    save.mutate(courses.filter((course): course is GpaCourse => course !== null));
  };

  const result = save.data?.result ?? data.gpa.result;

  return (
    <SectionCard
      id="gpa"
      title={t('gpa.title')}
      size="md"
      className="scroll-mt-28"
      end={
        <dl className="m-0 flex gap-2">
          <div className="flex min-w-24 flex-col items-center rounded-2xl bg-tint px-3 py-2 text-primary-text">
            <dd className="m-0 text-xl font-bold tabular-nums" aria-live="polite">
              {result === null ? '–' : f.number(result)}
            </dd>
            <dt className="text-xs">{t('gpa.result')}</dt>
          </div>
          <div className="flex min-w-24 flex-col items-center rounded-2xl bg-canvas px-3 py-2">
            <dd className="m-0 text-xl font-bold tabular-nums">{f.number(credits)}</dd>
            <dt className="text-xs text-text-2">{t('gpa.credits')}</dt>
          </div>
        </dl>
      }
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-3 px-5 pb-5 lg:px-7 lg:pb-7">
        <div
          aria-hidden="true"
          className={`hidden gap-2 text-[13px] text-text-2 sm:grid ${COLUMNS}`}
        >
          <span>{t('gpa.course')}</span>
          <span>{t('gpa.creditsLabel')}</span>
          <span>{t('gpa.grade')}</span>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((item, index) => {
            const n = f.number(index + 1);
            return (
              <li
                key={item.key}
                className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2 max-sm:rounded-2xl max-sm:bg-canvas max-sm:p-2 ${COLUMNS}`}
              >
                <div className="max-sm:col-span-3">
                  <TextField
                    hideLabel
                    label={t('gpa.courseN', { n })}
                    value={item.name}
                    onChange={(event) => update(item.key, 'name', event.target.value)}
                  />
                </div>
                <TextField
                  hideLabel
                  label={t('gpa.creditsN', { n })}
                  inputMode="numeric"
                  dir="ltr"
                  value={item.credits}
                  onChange={(event) => update(item.key, 'credits', event.target.value)}
                />
                <TextField
                  hideLabel
                  label={t('gpa.gradeN', { n })}
                  inputMode="decimal"
                  dir="ltr"
                  value={item.grade}
                  onChange={(event) => update(item.key, 'grade', event.target.value)}
                />
                <IconButton
                  icon="trash"
                  tone="muted"
                  aria-label={t('gpa.remove', { n })}
                  disabled={rows.length === 1}
                  onClick={() => setRows((current) => current.filter((other) => other !== item))}
                />
              </li>
            );
          })}
        </ol>
        <p className="m-0 text-[13px] leading-6 text-text-2">{t('gpa.note')}</p>
        {invalid && <Notice tone="error">{t('gpa.invalid')}</Notice>}
        {save.isError && <Notice tone="error">{t('gpa.error')}</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRows((current) => [...current, row()])}>
            {t('gpa.add')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t('gpa.calculating') : t('gpa.submit')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
