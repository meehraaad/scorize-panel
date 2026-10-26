import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { FileDrop } from '@/components/ui/Files';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { REVIEW_TYPES, type ReviewDocument } from '@/lib/applicant/journey';
import { KEY_KINDS, UPLOAD_KINDS } from './tray';
import { useReviewUpload } from './useReviewUpload';

/**
 * "What you have": a card per document only the person can send. Sent ones say so (how many files,
 * when); the two the review needs most stand out until they arrive.
 */
export function HaveCards({ files }: { files: ReviewDocument[] }) {
  const { t } = useTranslation('documents');
  return (
    <section aria-labelledby="docs-have" className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="docs-have" className="m-0 font-display text-[22px] font-black lg:text-2xl">
          {t('newUser.have.title')}
        </h2>
        <p className="m-0 text-sm leading-7 text-text-2">{t('newUser.have.subtitle')}</p>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {UPLOAD_KINDS.map((kind) => (
          <HaveCard key={kind} kind={kind} files={files.filter((file) => file.kind === kind)} />
        ))}
      </ul>
    </section>
  );
}

function HaveCard({
  kind,
  files,
}: {
  kind: (typeof UPLOAD_KINDS)[number];
  files: ReviewDocument[];
}) {
  const { t } = useTranslation('documents');
  const { t: tj } = useTranslation('journey');
  const f = useFormat();
  const { send, pending } = useReviewUpload();
  const name = tj(`review.kinds.${kind}`);
  const sent = files.length > 0;
  const key = KEY_KINDS.includes(kind);

  return (
    <li
      className={`flex flex-col gap-3 rounded-[24px] bg-surface p-5 shadow-panel ${
        key && !sent ? 'outline-[1.5px] outline-primary outline-solid' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className={`flex size-11 items-center justify-center rounded-[14px] ${
            sent ? 'bg-good-tint text-good' : 'bg-tint text-primary-text'
          }`}
        >
          <Icon name={sent ? 'fileCheck' : 'document'} size={22} />
        </span>
        {sent ? (
          <Chip tone="good" small>
            {t('newUser.have.sent')}
          </Chip>
        ) : (
          <Chip tone={key ? 'warn' : 'neutral'} small>
            {t(key ? 'newUser.have.key' : 'newUser.have.optional')}
          </Chip>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 text-[17px] font-bold">{name}</h3>
        <span className="text-[13px] leading-6 text-text-2">
          {sent
            ? t('newUser.have.sentMeta', {
                n: f.number(files.length),
                date: f.dateShort(files[0]?.uploaded_at ?? ''),
              })
            : t(`newUser.have.hint.${kind}`)}
        </span>
      </div>
      <div className="mt-auto">
        <FileDrop
          id={`docs-have-${kind}`}
          compact
          accept={REVIEW_TYPES}
          disabled={pending}
          chooseLabel={t(sent ? 'newUser.have.more' : 'newUser.have.upload')}
          inputLabel={tj('review.chooseFor', { kind: name })}
          onFile={(file) => send(kind, file)}
        />
      </div>
    </li>
  );
}
