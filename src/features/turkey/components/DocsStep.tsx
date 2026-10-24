import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FileDrop } from '@/components/ui/Files';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { checkFile, type FileProblem } from '@/lib/files';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { toast } from '@/lib/toast';
import {
  MAX_TURKEY_UPLOAD_BYTES,
  TURKEY_UPLOAD_TYPES,
  useSubmitTurkey,
  useUploadTurkeyDocument,
  type TurkeyCase,
  type TurkeyDocument,
  type TurkeyDocumentStatus,
} from '../api';

const RULE = { types: TURKEY_UPLOAD_TYPES, maxBytes: MAX_TURKEY_UPLOAD_BYTES };

const LOOK: Record<TurkeyDocumentStatus, { icon: IconName; tone: string }> = {
  missing: { icon: 'upload', tone: 'bg-neutral-tint text-text-2' },
  uploaded: { icon: 'check', tone: 'bg-tint text-primary-text' },
  review: { icon: 'clock', tone: 'bg-info-tint text-info' },
  approved: { icon: 'check', tone: 'bg-good-tint text-good' },
  rejected: { icon: 'alert', tone: 'bg-warn-tint text-warn' },
};

/** A document still needs the applicant: nothing sent yet, or sent back by the team. */
const needsFile = (doc: TurkeyDocument) =>
  doc.required && (doc.status === 'missing' || doc.status === 'rejected');

/**
 * Steps 2 and 3: upload each document (it goes up as soon as it is picked), then send them for
 * review. During review the list shows each verdict; a document sent back can be uploaded again
 * and the set re-sent.
 */
export function DocsStep({ data }: { data: TurkeyCase }) {
  const { t } = useTranslation('turkey');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const submit = useSubmitTurkey();
  const [incomplete, setIncomplete] = useState(false);
  const review = data.step === 'review';
  const required = data.documents.filter((doc) => doc.required);
  const approved = data.documents.filter((doc) => doc.status === 'approved').length;
  const rejected = data.documents.filter((doc) => doc.status === 'rejected').length;
  const ready = required.filter((doc) => !needsFile(doc)).length;
  // In review, sending again makes sense only once something new was uploaded.
  const canSend = !review || data.documents.some((doc) => doc.status === 'uploaded');

  const send = () => {
    setIncomplete(false);
    if (required.some(needsFile)) {
      setIncomplete(true);
      return;
    }
    submit.mutate(undefined, { onError: () => toast.error(t('docs.submitError')) });
  };

  const degree = data.answers ? tc(`degree.${data.answers.degree}`) : '';

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">
          {t(review ? 'docs.reviewTitle' : 'docs.title')}
        </h1>
        <p className="m-0 text-base leading-8 text-text-2">
          {review
            ? [
                t('docs.reviewSubtitle', {
                  approved: f.number(approved),
                  total: f.number(data.documents.length),
                }),
                rejected > 0 && t('docs.reviewRejected', { n: f.number(rejected) }),
              ]
                .filter(Boolean)
                .join(' ')
            : t('docs.subtitle', { degree })}
        </p>
      </div>

      <SectionCard
        id="turkey-docs"
        title={t('docs.label')}
        end={
          <div className="flex min-w-[180px] items-center gap-2.5">
            <ProgressBar
              value={percentOf(
                review ? approved : ready,
                review ? data.documents.length : required.length,
              )}
              tone={review ? 'good' : 'primary'}
              className="flex-1"
            />
            <span className="text-sm font-semibold whitespace-nowrap">
              {review
                ? t('docs.progressApproved', {
                    done: f.number(approved),
                    total: f.number(data.documents.length),
                  })
                : t('docs.progress', { done: f.number(ready), total: f.number(required.length) })}
            </span>
          </div>
        }
      >
        <ul className="m-0 list-none p-0">
          {data.documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </ul>
        <div className="flex flex-col gap-3 px-5 py-[18px] shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-[22px]">
          {incomplete && <Notice tone="error">{t('docs.incomplete')}</Notice>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm leading-7 text-text-2">
              {t(review ? 'docs.reviewFooter' : 'docs.footer')}
            </span>
            {canSend ? (
              <Button onClick={send} disabled={submit.isPending} className="w-full sm:w-auto">
                {submit.isPending ? t('docs.sending') : t(review ? 'docs.resubmit' : 'docs.submit')}
              </Button>
            ) : (
              <span className="text-sm font-medium text-info">{t('docs.waiting')}</span>
            )}
          </div>
        </div>
      </SectionCard>
    </>
  );
}

function DocumentRow({ doc }: { doc: TurkeyDocument }) {
  const { t } = useTranslation('turkey');
  const f = useFormat();
  const upload = useUploadTurkeyDocument();
  const [problem, setProblem] = useState<{ problem: FileProblem; size: number } | null>(null);
  const inputId = `turkey-doc-${String(doc.id)}`;
  const errorId = `${inputId}-error`;
  const look = LOOK[doc.status];
  // The team has it, or approved it: nothing to change.
  const locked = doc.status === 'review' || doc.status === 'approved';

  const choose = (file: File | undefined) => {
    if (!file) return;
    const found = checkFile(file, RULE);
    if (found) {
      setProblem({ problem: found, size: file.size });
      return;
    }
    setProblem(null);
    send(file);
  };
  const send = (file: File) =>
    upload.mutate({
      id: doc.id,
      file,
      messages: { failed: t('docs.uploadError'), retry: () => send(file) },
    });

  const meta =
    doc.status === 'missing'
      ? [!doc.required && t('docs.optional'), doc.hint].filter(Boolean).join(' · ')
      : t(`docs.status.${doc.status}`, { file: doc.file_name ?? '' });

  return (
    <li
      className={`flex flex-col gap-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-[18px] ${
        doc.status === 'rejected' ? 'bg-row-highlight' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex size-10 flex-none items-center justify-center rounded-full ${look.tone}`}
        >
          <Icon name={look.icon} size={18} />
        </span>
        <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{doc.name}</span>
          <span className="text-[13px] leading-6 text-text-2">{meta}</span>
        </span>
        {!locked &&
          (upload.isPending ? (
            <span className="text-sm text-text-2">{t('docs.uploading')}</span>
          ) : (
            <FileDrop
              id={inputId}
              compact
              accept={TURKEY_UPLOAD_TYPES}
              errorId={problem ? errorId : null}
              chooseLabel={t(
                doc.status === 'rejected'
                  ? 'docs.reupload'
                  : doc.status === 'uploaded'
                    ? 'docs.replace'
                    : 'docs.upload',
              )}
              inputLabel={t('docs.uploadLabel', { name: doc.name })}
              onFile={choose}
            />
          ))}
      </div>
      {doc.status === 'rejected' && doc.note && (
        <p className="m-0 rounded-[14px] bg-warn-tint px-4 py-3 text-sm leading-7 text-warn">
          <span className="font-semibold">{t('docs.noteLabel')}</span> {doc.note}
        </p>
      )}
      {problem && (
        <p id={errorId} className="m-0 text-sm leading-6 text-danger">
          {problem.problem === 'tooBig'
            ? t('docs.tooBig', {
                size: f.fileSize(problem.size),
                max: f.fileSize(MAX_TURKEY_UPLOAD_BYTES),
              })
            : t('docs.badType')}
        </p>
      )}
    </li>
  );
}
