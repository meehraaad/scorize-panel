import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { FileDrop, PickedFile } from '@/components/ui/Files';
import { Notice } from '@/components/ui/Notice';
import { StepBar } from '@/components/ui/Progress';
import { TextField } from '@/components/ui/TextField';
import { isCsv, MAX_CSV_BYTES } from '@/lib/csv';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  leadImportSampleHref,
  useApplyLeadImport,
  usePreviewLeadImport,
  type LeadImportChange,
  type LeadImportPreview,
  type LeadImportRow,
  type LeadImportSource,
  type SellerLoad,
} from '../api';

const STEPS = ['file', 'review', 'done'] as const;
const CHANGES: readonly LeadImportChange[] = ['new', 'existing', 'skip'];
const SOURCES = ['campaign', 'manual'] as const satisfies readonly LeadImportSource[];
const TONE: Record<LeadImportChange, ChipTone> = { new: 'info', existing: 'good', skip: 'danger' };
/** The seller select's value for the assignment queue. */
const QUEUE = 'queue';
/** Rows shown before "show the rest". */
const FIRST_ROWS = 8;

/**
 * Add leads from a CSV (the old site's marketing "Campaign CSV"): pick the file, see what each row
 * does (left-out rows say why), choose the source, a note and who gets them, then add them.
 */
export function LeadImportDialog({
  open,
  onClose,
  sellers,
}: {
  open: boolean;
  onClose: () => void;
  sellers: readonly SellerLoad[];
}) {
  const { t } = useTranslation('sales');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('manager.import.title')}
      subtitle={t('manager.import.subtitle')}
      closeLabel={t('manager.import.close')}
    >
      {/* Opening again starts over. */}
      {open && <ImportFlow onClose={onClose} sellers={sellers} />}
    </Dialog>
  );
}

function ImportFlow({ onClose, sellers }: { onClose: () => void; sellers: readonly SellerLoad[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const preview = usePreviewLeadImport();
  const apply = useApplyLeadImport();
  const [problem, setProblem] = useState<'badType' | 'tooBig' | null>(null);
  const [source, setSource] = useState<LeadImportSource>('campaign');
  const [note, setNote] = useState('');
  const [seller, setSeller] = useState<string>(QUEUE);
  const [notify, setNotify] = useState(false);
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
  };
  const adding = data ? data.counts.new + data.counts.existing : 0;
  const to = seller === QUEUE ? null : Number(seller);

  return (
    <>
      <StepBar
        label={t('manager.import.steps')}
        steps={STEPS.map((key, index) => ({
          key,
          label: t('manager.import.step', {
            n: f.number(index + 1),
            name: t(`manager.import.stepName.${key}`),
          }),
        }))}
        current={step}
        finished={step === 2}
      />

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <FileDrop
            id="lead-import-file"
            accept={['.csv', 'text/csv']}
            disabled={preview.isPending}
            errorId={problem || preview.isError ? 'lead-import-file-error' : null}
            chooseLabel={
              preview.isPending ? t('manager.import.reading') : t('manager.import.choose')
            }
            hint={t('manager.import.drop')}
            inputLabel={t('manager.import.choose')}
            onFile={pick}
          />
          {(problem || preview.isError) && (
            <span id="lead-import-file-error" className="text-[13px] leading-7 text-danger">
              {problem ? t(`manager.import.problem.${problem}`) : t('manager.import.readError')}
            </span>
          )}
          <Columns />
        </div>
      )}

      {step === 1 && data && (
        <div className="flex flex-col gap-4">
          <Review data={data} onAgain={again} />
          <ChoiceGroup
            legend={t('manager.import.source')}
            look="segmented"
            value={source}
            onChange={setSource}
            options={SOURCES.map((value) => ({
              value,
              label: t(`manager.import.sourceOption.${value}`),
            }))}
          />
          <TextField
            label={t('manager.import.note')}
            hint={t('manager.import.noteHint')}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
          <SelectField
            label={t('manager.import.to')}
            value={seller}
            onChange={setSeller}
            hint={seller === QUEUE ? t('manager.import.queueHint') : undefined}
            options={[
              { value: QUEUE, label: t('manager.import.queue') },
              ...sellers.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
          <label className="flex cursor-pointer gap-3 rounded-[18px] bg-canvas p-4">
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              aria-describedby="lead-import-notify-help"
              className="mt-1 size-[18px] flex-none accent-primary"
            />
            <span className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{t('manager.import.notify')}</span>
              <span id="lead-import-notify-help" className="text-[13px] leading-6 text-text-2">
                {t('manager.import.notifyHelp')}
              </span>
            </span>
          </label>
        </div>
      )}

      {step === 2 && apply.data && (
        <Notice tone="success">
          {t('manager.import.done', {
            n: f.number(apply.data.created),
            customers: f.number(apply.data.new_customers),
          })}
        </Notice>
      )}

      {/* The dialog's footer, kept in the flow so it follows the step. */}
      <div className="flex flex-wrap gap-2 pt-1">
        {step === 1 && data && (
          <>
            <Button
              disabled={adding === 0 || apply.isPending}
              onClick={() =>
                apply.mutate(
                  { token: data.token, source, note: note.trim(), seller: to, notify },
                  { onError: () => toast.error(t('manager.import.applyError')) },
                )
              }
            >
              {t('manager.import.apply', { n: f.number(adding) })}
            </Button>
            <Button variant="outline" onClick={again}>
              {t('manager.import.back')}
            </Button>
          </>
        )}
        <Button variant={step === 2 ? 'primary' : 'outline'} onClick={onClose}>
          {step === 2 ? t('manager.import.close') : t('manager.import.cancel')}
        </Button>
      </div>
    </>
  );
}

function Review({ data, onAgain }: { data: LeadImportPreview; onAgain: () => void }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [all, setAll] = useState(false);
  // Left-out rows first: they are what the manager may want to fix in the file.
  const rows = [...data.rows].sort(
    (a, b) => Number(b.change === 'skip') - Number(a.change === 'skip') || a.line - b.line,
  );
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);

  return (
    <>
      <PickedFile
        ext={t('manager.import.csv')}
        name={data.file.name}
        meta={t('manager.import.fileMeta', {
          rows: f.number(data.file.rows),
          size: f.number(Math.max(1, Math.round(data.file.size / 1024))),
        })}
        removeLabel={t('manager.import.otherFile')}
        onRemove={onAgain}
      />
      <ul
        aria-label={t('manager.import.summary')}
        className="m-0 flex list-none flex-wrap gap-2 p-0"
      >
        {CHANGES.filter((change) => data.counts[change] > 0).map((change) => (
          <li key={change}>
            <Chip tone={TONE[change]}>
              {t(`manager.import.count.${change}`, { n: f.number(data.counts[change]) })}
            </Chip>
          </li>
        ))}
      </ul>
      {data.rows.length === 0 && <Notice tone="warn">{t('manager.import.empty')}</Notice>}
      {data.rows.length > 0 && (
        <section aria-labelledby="lead-import-rows" className="flex flex-col gap-2">
          <h3 id="lead-import-rows" className="m-0 text-base font-bold">
            {t('manager.import.rows')}
          </h3>
          <ul className="m-0 flex list-none flex-col rounded-[18px] p-0 shadow-[inset_0_0_0_1px_var(--hair)]">
            {shown.map((row) => (
              <ImportRow key={row.line} row={row} />
            ))}
          </ul>
          {!all && rows.length > FIRST_ROWS && (
            <Button variant="outline" className="self-start" onClick={() => setAll(true)}>
              {t('manager.import.more', { n: f.number(rows.length - FIRST_ROWS) })}
            </Button>
          )}
        </section>
      )}
    </>
  );
}

function ImportRow({ row }: { row: LeadImportRow }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 not-first:shadow-[inset_0_1px_0_var(--hair)] ${
        row.change === 'skip' ? 'bg-danger-tint' : ''
      }`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <bdi className="truncate text-[15px] font-semibold">
          {row.name || t('manager.import.noName')}
        </bdi>
        <span className="text-[13px] text-text-2">
          <bdi dir="ltr">{row.phone ? f.digits(row.phone) : t('manager.import.noPhone')}</bdi>
          {' · '}
          {t('manager.import.line', { n: f.number(row.line) })}
        </span>
      </span>
      <Chip tone={TONE[row.change]} small>
        {row.change === 'skip'
          ? t(`manager.import.skip.${row.problem ?? 'bad_phone'}`)
          : t(`manager.import.change.${row.change}`)}
      </Chip>
    </li>
  );
}

function Columns() {
  const { t } = useTranslation('sales');
  return (
    <p className="m-0 text-[13px] leading-7 text-text-2">
      {t('manager.import.columns')} <bdi dir="ltr">{t('manager.import.columnNames')}</bdi>.{' '}
      {t('manager.import.columnsOptional')}{' '}
      <a href={leadImportSampleHref} download className="font-medium">
        {t('manager.import.sample')}
      </a>
    </p>
  );
}
