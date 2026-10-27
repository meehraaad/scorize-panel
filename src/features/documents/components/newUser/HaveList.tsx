import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDrop } from '@/components/ui/Files';
import { useFormat } from '@/lib/i18n/useFormat';
import { REVIEW_TYPES, type ReviewDocument, type ReviewKind } from '@/lib/applicant/journey';
import { ReviewFile } from './ReviewFile';
import { UPLOAD_KINDS } from './tray';
import { useReviewUpload } from './useReviewUpload';

/**
 * "Your documents": one quiet list, a row per document only the person can send (and any other
 * kind they sent). A sent row opens to its files, each with delete, and takes another file.
 */
export function HaveList({ files }: { files: ReviewDocument[] }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const others = [...new Set(files.map((file) => file.kind))].filter(
    (kind) => !(UPLOAD_KINDS as readonly ReviewKind[]).includes(kind),
  );
  const kinds: ReviewKind[] = [...UPLOAD_KINDS, ...others];
  const sent = UPLOAD_KINDS.filter((kind) => files.some((file) => file.kind === kind)).length;

  return (
    <section aria-labelledby="docs-have" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="docs-have" className="m-0 font-display text-[22px] font-black">
          {t('newUser.have.title')}
        </h2>
        <span className="text-sm text-text-2">
          {t('newUser.have.count', { n: f.number(sent), total: f.number(UPLOAD_KINDS.length) })}
        </span>
      </div>
      <ul className="m-0 list-none rounded-[28px] bg-surface px-5 py-1 shadow-panel lg:px-7">
        {kinds.map((kind) => (
          <HaveRow key={kind} kind={kind} files={files.filter((file) => file.kind === kind)} />
        ))}
      </ul>
    </section>
  );
}

function HaveRow({ kind, files }: { kind: ReviewKind; files: ReviewDocument[] }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const { send, pending } = useReviewUpload();
  const [open, setOpen] = useState(false);
  const name = t(`review.kinds.${kind}`);
  const sent = files.length > 0;
  const panel = `docs-have-${kind}-files`;

  return (
    <li className="border-b border-hair last:border-b-0">
      <div className="flex min-h-[76px] items-center gap-4 py-3">
        <span
          aria-hidden="true"
          className={`size-2.5 flex-none rounded-full ${sent ? 'bg-good' : 'bg-line-2'}`}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-bold">{name}</span>
          <span className="text-[13px] text-text-2">
            {sent
              ? t('newUser.have.sentMeta', { n: f.number(files.length) })
              : t(`newUser.have.hint.${kind as (typeof UPLOAD_KINDS)[number]}`)}
          </span>
        </span>
        {sent ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => setOpen(!open)}
            className="min-h-11 rounded-full bg-canvas px-[18px] text-sm font-bold text-text"
          >
            {t(open ? 'newUser.have.hide' : 'newUser.have.files')}
          </button>
        ) : (
          <FileDrop
            id={`docs-have-${kind}`}
            compact
            accept={REVIEW_TYPES}
            disabled={pending}
            chooseLabel={t('newUser.have.upload')}
            inputLabel={t('review.chooseFor', { kind: name })}
            onFile={(file) => send(kind, file)}
          />
        )}
      </div>
      {sent && open && (
        <div id={panel} className="flex flex-col gap-3 pb-5">
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 xl:grid-cols-2">
            {files.map((file) => (
              <ReviewFile key={file.id} file={file} />
            ))}
          </ul>
          <FileDrop
            id={`docs-have-${kind}-more`}
            compact
            accept={REVIEW_TYPES}
            disabled={pending}
            chooseLabel={t('newUser.have.more')}
            inputLabel={t('review.chooseFor', { kind: name })}
            onFile={(file) => send(kind, file)}
          />
        </div>
      )}
    </li>
  );
}
