import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { TurkeyDocumentRow } from '@/components/applicant/TurkeyDocumentRow';
import { FileDrop } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { REVIEW_TYPES, type ReviewDocument, type ReviewKind } from '@/lib/applicant/journey';
import type { TurkeyCase } from '@/lib/applicant/turkey';
import { toast } from '@/lib/toast';
import { OFFERED_KINDS, useStartWriting, type OfferedKind, type WritingOffer } from '../../offers';
import { ReviewFile } from './ReviewFile';
import { UPLOAD_KINDS } from './tray';
import { useReviewUpload } from './useReviewUpload';

const ROW = 'px-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-8';

/**
 * "Your documents": one quiet list. First the documents only the person can send: Turkey's list
 * for their degree, tagged with what Turkey needs (once they have one), or else the free review's.
 * Then the case's texts, each with "upload" (I have it) and "we write it" with the price. A sent
 * row opens to its files, each with delete, and takes another file.
 */
export function DocumentList({
  files,
  offers,
  turkey,
}: {
  files: ReviewDocument[];
  offers: WritingOffer[];
  /** The Turkey request, once it has its document list. */
  turkey: TurkeyCase | null;
}) {
  const { t } = useTranslation('documents');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const others = [...new Set(files.map((file) => file.kind))].filter(
    (kind) => !([...UPLOAD_KINDS, ...OFFERED_KINDS] as readonly ReviewKind[]).includes(kind),
  );
  const kinds: ReviewKind[] = [...UPLOAD_KINDS, ...others];
  const required = turkey?.documents.filter((doc) => doc.required) ?? [];
  const left = required.filter((doc) => doc.status === 'missing').length;
  const [done, total] = turkey
    ? [required.length - left, required.length]
    : [
        UPLOAD_KINDS.filter((kind) => files.some((file) => file.kind === kind)).length,
        UPLOAD_KINDS.length,
      ];

  return (
    <section aria-labelledby="docs-have" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="docs-have" className="m-0 font-display text-[22px] font-black">
          {t('newUser.have.title')}
        </h2>
        <span className="text-sm text-text-2">
          {turkey?.answers
            ? t('newUser.turkey.level', { degree: tc(`degree.${turkey.answers.degree}`) })
            : t('newUser.have.count', { n: f.number(done), total: f.number(total) })}
        </span>
      </div>
      <ul className="m-0 list-none overflow-hidden rounded-[28px] bg-surface p-0 shadow-panel">
        {turkey
          ? turkey.documents.map((doc) => <TurkeyDocumentRow key={doc.id} doc={doc} tagged />)
          : kinds.map((kind) => (
              <HaveRow key={kind} kind={kind} files={files.filter((file) => file.kind === kind)} />
            ))}
        <li className={`flex flex-col pt-[22px] pb-1.5 ${ROW}`}>
          <span className="text-sm font-extrabold">{t('newUser.texts.title')}</span>
          {offers.length > 0 && (
            <span className="text-[13px] text-text-2">{t('newUser.texts.text')}</span>
          )}
        </li>
        {OFFERED_KINDS.map((kind) => (
          <HaveRow
            key={kind}
            kind={kind}
            files={files.filter((file) => file.kind === kind)}
            offer={offers.find((offer) => offer.kind === kind)}
          />
        ))}
        {turkey && (
          <li className={`bg-row-highlight py-5 text-sm leading-7 text-text-2 ${ROW}`}>
            {left > 0 ? t('newUser.turkey.left', { n: f.number(left) }) : t('newUser.turkey.allIn')}
          </li>
        )}
      </ul>
    </section>
  );
}

type OfferState = 'none' | 'draft' | 'paid' | 'writing' | 'ready';

function stateOf(offer: WritingOffer): OfferState {
  const { order } = offer;
  if (!order) return 'none';
  if (!order.paid) return 'draft';
  return order.step === 'form' ? 'paid' : order.step;
}

function HaveRow({
  kind,
  files,
  offer,
}: {
  kind: ReviewKind;
  files: ReviewDocument[];
  /** A text we can write: "we write it" next to the upload. */
  offer?: WritingOffer | undefined;
}) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const { send, pending } = useReviewUpload();
  const [open, setOpen] = useState(false);
  const name = t(`review.kinds.${kind}`);
  const sent = files.length > 0;
  const panel = `docs-have-${kind}-files`;
  const state = offer && stateOf(offer);
  const hint = (OFFERED_KINDS as readonly string[]).includes(kind)
    ? t(`newUser.write.pitch.${kind as OfferedKind}`)
    : t(`newUser.have.hint.${kind as (typeof UPLOAD_KINDS)[number]}`);

  return (
    <li className={ROW}>
      <div className="flex min-h-[76px] flex-wrap items-center gap-x-4 gap-y-3 py-3">
        <span
          aria-hidden="true"
          className={`size-2.5 flex-none rounded-full ${sent ? 'bg-good' : 'bg-line-2'}`}
        />
        <span className="flex min-w-0 flex-[1_1_200px] flex-col">
          <span className="text-base font-bold">{name}</span>
          <span className="text-[13px] text-text-2">
            {sent
              ? t('newUser.have.sentMeta', { n: f.number(files.length) })
              : state && state !== 'none'
                ? t(`newUser.write.state.${state}`)
                : hint}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2.5">
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
          {offer && <WriteAction offer={offer} name={name} />}
        </span>
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

const WRITE =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-tint px-[18px] text-sm font-bold text-primary-text disabled:opacity-50';

/**
 * "We write it" with the price; once ordered, back to its form or order. The form opens now;
 * payment is at its final submit.
 */
function WriteAction({ offer, name }: { offer: WritingOffer; name: string }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const navigate = useNavigate();
  const start = useStartWriting();
  const state = stateOf(offer);
  const { kind } = offer;

  if (state !== 'none')
    return (
      <Link to={`/documents/${kind}`} className={WRITE}>
        {t(state === 'draft' ? 'newUser.write.continue' : 'newUser.write.view')}
      </Link>
    );
  return (
    <button
      type="button"
      className={WRITE}
      disabled={start.isPending}
      aria-label={t('newUser.texts.writeFor', { name })}
      onClick={() =>
        start.mutate(kind, {
          onSuccess: () => void navigate(`/documents/${kind}`),
          onError: () => toast.error(t('newUser.write.startError')),
        })
      }
    >
      <Icon name="pen" size={15} />
      {t('newUser.texts.write', { price: f.number(offer.price) })}
    </button>
  );
}
