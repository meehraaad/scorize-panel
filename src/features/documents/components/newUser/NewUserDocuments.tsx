import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { reviewDocumentsQuery } from '@/lib/applicant/journey';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { turkeyQuery } from '@/lib/applicant/turkey';
import { writingOffersQuery } from '../../offers';
import { CallLine } from './CallLine';
import { DocsHero } from './DocsHero';
import { DocumentList } from './DocumentList';
import { TurkeyHero } from './TurkeyHero';
import { TurkeyStatus } from './TurkeyStatus';
import { nextKind } from './tray';

const WRAP = 'mx-auto flex w-full max-w-[1040px] flex-col gap-14 lg:gap-[72px]';

/**
 * The documents tab without a contract. Design: canvas "قرارداد و پرداخت: بدون قرارداد",
 * documents. Uploading the documents starts Turkey (the Turkey ticket on the contract tab): a
 * forest hero with the route and the next document, then, once one is in, where the request is
 * (TurkeyStatus). One list holds the documents and the texts we offer to write; a line says the
 * same documents serve other countries; a call request. Until Django serves Turkey
 * (ON_SERVER.turkey) the hero is the free review's. Narrow and spacious on purpose.
 */
export function NewUserDocuments({ access }: { access: ApplicantAccess }) {
  return ON_SERVER.turkey ? (
    <TurkeyDocuments access={access} />
  ) : (
    <ReviewDocuments access={access} />
  );
}

function ReviewDocuments({ access }: { access: ApplicantAccess }) {
  const { data: files } = useSuspenseQuery(reviewDocumentsQuery);
  const { data: writing } = useSuspenseQuery(writingOffersQuery);

  return (
    <div className={WRAP}>
      <DocsHero next={nextKind(files)} />
      <DocumentList files={files} offers={writing.included ? [] : writing.offers} turkey={null} />
      <CallLine phone={access.phone} />
    </div>
  );
}

function TurkeyDocuments({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('documents');
  const { data: files } = useSuspenseQuery(reviewDocumentsQuery);
  const { data: writing } = useSuspenseQuery(writingOffersQuery);
  const { data: turkey } = useSuspenseQuery(turkeyQuery);
  // Nothing in yet: the hero that says uploading starts Turkey. Then where the request is.
  const started = turkey.documents.some((doc) => doc.status !== 'missing');

  return (
    <div className={WRAP}>
      {started ? <TurkeyStatus data={turkey} /> : <TurkeyHero data={turkey} />}
      <div className="flex flex-col gap-6">
        <DocumentList
          files={files}
          offers={writing.included ? [] : writing.offers}
          turkey={turkey.documents.length > 0 ? turkey : null}
        />
        <p className="m-0 text-sm leading-8 text-text-2">
          {t('newUser.turkey.others')}{' '}
          <Link to="/consultations/book" className="font-bold text-primary-text">
            {t('newUser.turkey.book')}
          </Link>
        </p>
      </div>
      <CallLine phone={access.phone} />
    </div>
  );
}
