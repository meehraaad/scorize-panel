import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CallRequestButton } from '@/components/applicant/CallRequest';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import type { ReviewDocument, ReviewKind, StartOffers } from '@/lib/applicant/journey';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { ConsultSlots } from './ConsultSlots';

/**
 * What the free Turkey application starts with, as the design lists it. The Turkey request's own
 * list (H30, by degree) takes over once it is on the server.
 */
const TURKEY_KINDS = ['transcript', 'passport', 'degree'] as const satisfies ReviewKind[];

/**
 * Right after the first file for a free review: it arrived and what happens next, a time for the
 * session that goes over the review, and how close the same files are to a Turkey application.
 * Design: "Scorize New User Dashboard v2" canvas, AfterUpload.
 */
export function AfterUpload({
  files,
  offers,
  phone,
  onUpload,
}: {
  /** Newest first (Django's order). */
  files: ReviewDocument[];
  offers: StartOffers;
  phone: string | null;
  /** Opens the upload card on this kind of file. */
  onUpload: (kind: ReviewKind) => void;
}) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const newest = files[0];
  if (!newest) return null;
  const sent = new Set(files.map((file) => file.kind));
  const missing = TURKEY_KINDS.filter((kind) => !sent.has(kind));
  const consultant = offers.consultant?.name;

  return (
    <div className="flex flex-col gap-4">
      <Card aria-labelledby="journey-received" className="flex items-center gap-4 p-5 lg:p-6">
        <span
          aria-hidden="true"
          className="flex size-14 flex-none items-center justify-center rounded-[18px] bg-good-tint text-good"
        >
          <Icon name="check" size={28} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="journey-received" className="m-0 font-display text-xl font-bold">
            {t('received.title', { kind: t(`review.kinds.${newest.kind}`) })}
          </h2>
          <p className="m-0 text-sm leading-7 text-text-2">
            {consultant ? t('received.textNamed', { name: consultant }) : t('received.text')}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {offers.consultation && (
          <Card aria-labelledby="journey-book" className="flex flex-col gap-3 p-5 lg:p-6">
            <span className="text-[13px] font-semibold text-primary-text">{t('book.kicker')}</span>
            <h3 id="journey-book" className="m-0 text-lg font-bold">
              {t('book.title')}
            </h3>
            <p className="m-0 text-[13px] leading-6 text-text-2">{t('book.text')}</p>
            <div className="mt-auto">
              <ConsultSlots offer={offers.consultation} />
            </div>
          </Card>
        )}

        <Card
          aria-labelledby="journey-turkey-docs"
          className="flex flex-col gap-3 p-5 shadow-[0_0_0_1.5px_var(--primary),var(--panel-shadow)] lg:p-6"
        >
          <Chip tone="good" small>
            {t('paths.turkey.chip')}
          </Chip>
          <h3 id="journey-turkey-docs" className="m-0 text-lg font-bold">
            {missing.length
              ? t('turkeyDocs.title', { n: f.number(missing.length) })
              : t('turkeyDocs.titleDone')}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {TURKEY_KINDS.map((kind) => {
              const done = sent.has(kind);
              const name = t(`review.kinds.${kind}`);
              return (
                <li key={kind} className="flex min-h-11 items-center gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className={`flex size-6 flex-none items-center justify-center rounded-full ${
                      done ? 'bg-good-tint text-good' : 'shadow-[inset_0_0_0_1.5px_var(--line-3)]'
                    }`}
                  >
                    {done && <Icon name="check" size={14} />}
                  </span>
                  <span className={`min-w-0 flex-1 ${done ? 'text-text-2' : 'font-semibold'}`}>
                    {name}
                    <span className="sr-only">
                      {' '}
                      {t(done ? 'turkeyDocs.sent' : 'turkeyDocs.missing')}
                    </span>
                  </span>
                  {!done && (
                    <button
                      type="button"
                      onClick={() => onUpload(kind)}
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text"
                    >
                      {t('turkeyDocs.upload', { name })}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {missing.length === 0 &&
            (ON_SERVER.turkey ? (
              <Link to="/turkey" className={buttonClass('primary', 'mt-auto w-full')}>
                {t('paths.turkey.start')}
              </Link>
            ) : (
              <CallRequestButton
                label={t('paths.turkey.call')}
                className={buttonClass('primary', 'mt-auto w-full')}
                phone={phone}
                topic="turkey"
                page="home"
                reason="guest"
              />
            ))}
        </Card>
      </div>
    </div>
  );
}
