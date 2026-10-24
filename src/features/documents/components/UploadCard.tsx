import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Chip } from '@/components/ui/Chip';
import { FileDrop, PickedFile } from '@/components/ui/Files';
import { Notice } from '@/components/ui/Notice';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { daysUntil, isPast } from '@/lib/dates';
import { checkFile, extensionOf, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_TYPES,
  UploadError,
  useUploadDocuments,
  type DocumentsData,
  type RequiredDocument,
} from '../api';

/** A deadline this close is shown in the warning colour. */
const URGENT_DAYS = 7;

type Problem = FileProblem;
const RULE = { types: UPLOAD_TYPES, maxBytes: MAX_UPLOAD_BYTES };

/**
 * The documents the team still needs: pick a file per document (or drop it on the field), then
 * send them together. Files are checked here first, so a phone doesn't upload 30 MB to be refused.
 */
export function UploadCard({ data }: { data: DocumentsData }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const upload = useUploadDocuments();
  const [picked, setPicked] = useState<Record<number, File>>({});
  const [problems, setProblems] = useState<Record<number, { problem: Problem; size: number }>>({});
  const [message, setMessage] = useState<'pickFirst' | 'sent' | { failed: number } | null>(null);

  const required = data.required;
  const chosen = required.filter((item) => picked[item.id]);

  const choose = (item: RequiredDocument, file: File | undefined) => {
    setMessage(null);
    const rest = <T,>(record: Record<number, T>) =>
      Object.fromEntries(Object.entries(record).filter(([id]) => Number(id) !== item.id));
    if (!file) return;
    const problem = checkFile(file, RULE);
    if (problem) {
      setPicked(rest);
      setProblems((previous) => ({ ...previous, [item.id]: { problem, size: file.size } }));
    } else {
      setProblems(rest);
      setPicked((previous) => ({ ...previous, [item.id]: file }));
    }
  };

  const unpick = (id: number) => {
    setPicked((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([key]) => Number(key) !== id)),
    );
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!chosen.length) {
      setMessage('pickFirst');
      return;
    }
    const uploads = chosen.flatMap((item) => {
      const file = picked[item.id];
      return file ? [{ id: item.id, file }] : [];
    });
    upload.mutate(uploads, {
      onSuccess: () => {
        setPicked({});
        setMessage('sent');
      },
      onError: (error) => {
        // Keep only the files that didn't go through, ready to send again.
        const failed = error instanceof UploadError ? error.ids : uploads.map((item) => item.id);
        setPicked((previous) =>
          Object.fromEntries(
            Object.entries(previous).filter(([id]) => failed.includes(Number(id))),
          ),
        );
        setMessage({ failed: failed.length });
      },
    });
  };

  return (
    <SectionCard
      id="docs-required"
      title={t('required.title')}
      subtitle={t('required.hint', { size: f.fileSize(MAX_UPLOAD_BYTES) })}
      end={
        <div className="flex min-w-[180px] items-center gap-2.5">
          <ProgressBar
            value={percentOf(data.progress.uploaded, data.progress.required)}
            className="flex-1"
          />
          <span className="text-sm font-semibold whitespace-nowrap">
            {t('required.progress', {
              uploaded: f.number(data.progress.uploaded),
              required: f.number(data.progress.required),
            })}
          </span>
        </div>
      }
    >
      {required.length === 0 ? (
        <>
          {message === 'sent' && (
            <div className="px-5 lg:px-8">
              <Notice tone="success">{t('required.sent')}</Notice>
            </div>
          )}
          <EmptyState title={t('required.completeTitle')}>{t('required.complete')}</EmptyState>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col">
          {required.map((item) => (
            <RequiredRow
              key={item.id}
              item={item}
              file={picked[item.id]}
              problem={problems[item.id]}
              disabled={upload.isPending}
              onChoose={(file) => choose(item, file)}
              onRemove={() => unpick(item.id)}
            />
          ))}
          <div className="flex flex-col gap-3 px-5 py-[18px] shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-[22px]">
            {message === 'pickFirst' && <Notice tone="error">{t('required.pickFirst')}</Notice>}
            {message === 'sent' && <Notice tone="success">{t('required.sent')}</Notice>}
            {typeof message === 'object' && message !== null && (
              <Notice tone="error">{t('required.failed', { n: f.number(message.failed) })}</Notice>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-text-2">{t('required.footer')}</span>
              <Button type="submit" disabled={upload.isPending} className="w-full sm:w-auto">
                {upload.isPending
                  ? t('required.sending')
                  : chosen.length
                    ? t('required.submit', { n: f.number(chosen.length) })
                    : t('required.submitNone')}
              </Button>
            </div>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

interface RowProps {
  item: RequiredDocument;
  file: File | undefined;
  problem: { problem: Problem; size: number } | undefined;
  disabled: boolean;
  onChoose: (file: File | undefined) => void;
  onRemove: () => void;
}

function RequiredRow({ item, file, problem, disabled, onChoose, onRemove }: RowProps) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const inputId = `doc-${String(item.id)}`;
  const errorId = `${inputId}-error`;
  const days = item.deadline === null ? null : daysUntil(item.deadline);
  const overdue = item.deadline !== null && isPast(item.deadline);

  return (
    <div className="flex flex-col gap-3 px-5 py-[18px] shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-base font-semibold">
          {item.name}
        </label>
        <Chip tone={overdue ? 'danger' : days !== null && days <= URGENT_DAYS ? 'warn' : 'neutral'}>
          {item.deadline === null
            ? t('required.noDeadline')
            : overdue
              ? t('required.overdue')
              : [
                  t('required.deadline', { date: f.dateShort(item.deadline) }),
                  t('required.daysLeft', { n: f.number(days ?? 0) }),
                ].join(' · ')}
        </Chip>
      </div>

      {item.note && (
        <p className="m-0 rounded-[14px] bg-warn-tint px-4 py-3 text-sm leading-7 text-warn">
          <span className="font-semibold">{t('required.noteLabel')}</span> {item.note}
        </p>
      )}

      {file ? (
        <PickedFile
          ext={extensionOf(file.name)}
          name={file.name}
          meta={t('required.ready', { size: f.fileSize(file.size) })}
          removeLabel={t('required.remove', { name: item.name })}
          disabled={disabled}
          onRemove={onRemove}
        />
      ) : (
        <FileDrop
          id={inputId}
          accept={UPLOAD_TYPES}
          disabled={disabled}
          errorId={problem ? errorId : null}
          chooseLabel={t('required.choose')}
          hint={t('required.dropHint')}
          touchHint={t('required.dropHintTouch')}
          onFile={onChoose}
        />
      )}

      {problem && (
        <p id={errorId} className="m-0 text-sm leading-7 text-danger">
          {problem.problem === 'tooBig'
            ? t('required.tooBig', {
                size: f.fileSize(problem.size),
                max: f.fileSize(MAX_UPLOAD_BYTES),
              })
            : t('required.badType')}
        </p>
      )}
    </div>
  );
}
