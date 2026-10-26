import { useSuspenseQuery } from '@tanstack/react-query';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { reviewDocumentsQuery } from '@/lib/applicant/journey';
import { writingOffersQuery } from '../../offers';
import { CallCard } from './CallCard';
import { DocsHero } from './DocsHero';
import { HaveCards } from './HaveCards';
import { OfferCards } from './OfferCards';
import { Samples } from './Samples';
import { SentFiles } from './SentFiles';
import { nextKind, trayOf } from './tray';

/**
 * The documents tab without a contract. Design: "Scorize New User Dashboard v2" canvas
 * (DocumentsGuest). Send your documents for a free review; what you don't have, the writing team
 * writes (the form opens now, payment at its final submit); admissions won with the same papers;
 * the files sent; or an advisor calls and asks for it all by phone.
 */
export function NewUserDocuments({ access }: { access: ApplicantAccess }) {
  const { data: files } = useSuspenseQuery(reviewDocumentsQuery);
  const { data: writing } = useSuspenseQuery(writingOffersQuery);
  const offers = writing.included ? [] : writing.offers;

  return (
    <>
      <DocsHero tray={trayOf(files, offers)} next={nextKind(files)} />
      <HaveCards files={files} />
      <OfferCards offers={offers} />
      <Samples samples={writing.samples} />
      <SentFiles files={files} />
      <CallCard phone={access.phone} />
    </>
  );
}
