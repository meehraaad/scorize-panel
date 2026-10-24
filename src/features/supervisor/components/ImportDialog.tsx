import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { FileDrop, PickedFile } from '@/components/ui/Files';
import { Notice } from '@/components/ui/Notice';
import { StepBar } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  importSampleHref,
  isCsv,
  MAX_CSV_BYTES,
  useApplyImport,
  usePreviewImport,
  type ImportChange,
  type ImportPreview,
  type ImportRow,
} from '../api';

const STEPS = ['file', 'review', 'done'] as const;
const CHANGES: readonly ImportChange[] = ['update', 'add', 'same', 'skip'];
const TONE: Record<ImportChange, ChipTone> = {
  update: 'good',
  add: 'info',
  same: 'neutral',
  skip: 'danger',
};
/** Rows shown before "show the rest". */
const FIRST_ROWS = 6;

/**
 * Import application results from a CSV: pick the file, see every change it makes (rows that
 * can't be applied are named and left out), then apply them, optionally telling the applicants.
 * Design: canvas V8 "سوپروایزر · ورود نتایج از CSV" (SupImport).
 */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('supervisor');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('import.title')}
      subtitle={t('import.subtitle')}
      closeLabel={t('close')}
    >
      {/* Opening again starts over. */}
      {open && <ImportFlow onClose={onClose} />}
    </Dialog>
  );
}

function ImportFlow({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const preview = usePreviewImport();
  const apply = useApplyImport();
  const [problem, setProblem] = useState<'badType' | 'tooBig' | null>(null);
  const [notify, setNotify] = useState(true);
  const [all, setAll] = useState(false);
  const data = preview.data;
  const step = apply.isSuccess ? 2 : data ? 1 : 0;

  const pick = (file: File | undefined) => {
    if (!file) return;
    const issue = !isCsv(file) ? 'badType' : file.size > MAX_CSV_BYTES ? 'tooBig' : null;
    setProblem(issue);
    if (!issue) preview.mutate(file);
  };
  const again = () => {
    preview.reset();
    apply.reset();
    setAll(false);
  };
  const changes = data ? data.counts.update + data.counts.add : 0;

  return (
    <>
      <StepBar
        label={t('import.steps')}
        steps={STEPS.map((key, index) => ({
          key,
          label: t('import.step', { n: f.number(index + 1), name: t(`import.stepName.${key}`) }),
        }))}
        current={step}
        finished={step === 2}
      />

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <FileDrop
            id="import-file"
            accept={['.csv', 'text/csv']}
            disabled={preview.isPending}
            errorId={problem || preview.isError ? 'import-file-error' : null}
            chooseLabel={preview.isPending ? t('import.reading') : t('import.choose')}
            hint={t('import.drop')}
            inputLabel={t('import.choose')}
            onFile={pick}
          />
          {(problem || preview.isError) && (
            <span id="import-file-error" className="text-[13px] leading-7 text-danger">
              {problem ? t(`import.problem.${problem}`) : t('import.readError')}
            </span>
          )}
          <Columns />
        </div>
      )}

      {step === 1 && data && (
        <Review
          data={data}
          notify={notify}
          onNotify={setNotify}
          all={all}
          onAll={() => setAll(true)}
          onAgain={again}
        />
      )}

      {step === 2 && (
        <Notice tone="success">
          {t('import.done', { n: f.number(apply.data?.applied ?? changes) })}
        </Notice>
      )}

      {/* The dialog's footer, kept in the flow so it follows the step. */}
      <div className="flex flex-wrap gap-2 pt-1">
        {step === 1 && (
          <>
            <Button
              disabled={changes === 0 || apply.isPending}
              onClick={() =>
                data &&
                apply.mutate(
                  { token: data.token, notify },
                  { onError: () => toast.error(t('import.applyError')) },
                )
              }
            >
              {t('import.apply', { n: f.number(changes) })}
            </Button>
            <Button variant="outline" onClick={again}>
              {t('import.back')}
            </Button>
          </>
        )}
        <Button variant={step === 2 ? 'primary' : 'outline'} onClick={onClose}>
          {step === 2 ? t('close') : t('cancel')}
        </Button>
      </div>
    </>
  );
}

function Review({
  data,
  notify,
  onNotify,
  all,
  onAll,
  onAgain,
}: {
  data: ImportPreview;
  notify: boolean;
  onNotify: (value: boolean) => void;
  all: boolean;
  onAll: () => void;
  onAgain: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  // Rows that do something first, left-out ones last; unchanged rows only in the counts.
  const order: Record<ImportChange, number> = { update: 0, add: 1, skip: 2, same: 3 };
  const rows = [...data.rows].sort((a, b) => order[a.change] - order[b.change] || a.line - b.line);
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  const skipped = data.rows.filter((row) => row.change === 'skip');

  return (
    <div className="flex flex-col gap-4">
      <PickedFile
        ext={t('import.csv')}
        name={data.file.name}
        meta={t('import.fileMeta', {
          rows: f.number(data.file.rows),
          size: f.number(Math.max(1, Math.round(data.file.size / 1024))),
        })}
        removeLabel={t('import.otherFile')}
        onRemove={onAgain}
      />
      <ul aria-label={t('import.summary')} className="m-0 flex list-none flex-wrap gap-2 p-0">
        {CHANGES.filter((change) => data.counts[change] > 0).map((change) => (
          <li key={change}>
            <Chip tone={TONE[change]}>
              {t(`import.count.${change}`, { n: f.number(data.counts[change]) })}
            </Chip>
          </li>
        ))}
      </ul>
      {skipped.map((row) => (
        <Notice key={row.line} tone="warn">
          <strong>{t('import.lineLabel', { n: f.number(row.line) })}</strong>{' '}
          {t(`import.problemRow.${row.problem ?? 'case_not_found'}`, {
            file: row.file_number === null ? t('dash') : f.digits(String(row.file_number)),
          })}
        </Notice>
      ))}

      <section aria-labelledby="import-changes" className="flex flex-col gap-2">
        <h3 id="import-changes" className="m-0 text-base font-bold">
          {t('import.changes')}
        </h3>
        <ul className="m-0 flex list-none flex-col rounded-[18px] p-0 shadow-[inset_0_0_0_1px_var(--hair)]">
          {shown.map((row) => (
            <ChangeRow key={row.line} row={row} />
          ))}
        </ul>
        {!all && rows.length > FIRST_ROWS && (
          <Button variant="outline" className="self-start" onClick={onAll}>
            {t('import.more', { n: f.number(rows.length - FIRST_ROWS) })}
          </Button>
        )}
      </section>

      <label className="flex cursor-pointer gap-3 rounded-[18px] bg-canvas p-4">
        <input
          type="checkbox"
          checked={notify}
          onChange={(event) => onNotify(event.target.checked)}
          aria-describedby="import-notify-help"
          className="mt-1 size-[18px] flex-none accent-primary"
        />
        <span className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold">{t('import.notify')}</span>
          <span id="import-notify-help" className="text-[13px] leading-6 text-text-2">
            {t('import.notifyHelp')}
          </span>
        </span>
      </label>
      <Columns />
    </div>
  );
}

function ChangeRow({ row }: { row: ImportRow }) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const file =
    row.file_number === null ? '' : t('fileNumber', { n: f.digits(String(row.file_number)) });
  const who = row.applicant
    ? `${row.applicant.name} · ${file}`
    : `${file} · ${t('import.line', { n: f.number(row.line) })}`;
  const next =
    row.change === 'skip'
      ? t(`import.skipShort.${row.problem ?? 'case_not_found'}`)
      : row.change === 'same'
        ? t('import.same')
        : row.change === 'add'
          ? t('import.added')
          : row.new
            ? t(`result.${row.new}`)
            : t('dash');
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 not-first:shadow-[inset_0_1px_0_var(--hair)] ${
        row.change === 'skip' ? 'bg-danger-tint' : ''
      }`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <bdi className="truncate text-[15px] font-semibold">{row.university}</bdi>
        <span className="text-[13px] text-text-2">{who}</span>
      </span>
      <span className="flex items-center gap-2 text-[13px]">
        {row.change === 'update' && row.old && (
          <>
            <span className="text-text-2">{t(`result.${row.old}`)}</span>
            <span className="sr-only">{t('import.to')}</span>
            <span aria-hidden="true" className="text-text-2">
              {t('import.arrow')}
            </span>
          </>
        )}
        <Chip tone={TONE[row.change]} small>
          {next}
        </Chip>
      </span>
    </li>
  );
}

function Columns() {
  const { t } = useTranslation('supervisor');
  return (
    <p className="m-0 text-[13px] leading-7 text-text-2">
      {t('import.columns')} <bdi dir="ltr">{t('import.columnNames')}</bdi>.{' '}
      <a href={importSampleHref} download className="font-medium">
        {t('import.sample')}
      </a>
    </p>
  );
}
