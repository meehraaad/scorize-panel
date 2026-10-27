import { useSuspenseQuery } from '@tanstack/react-query';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { reviewDocumentsQuery } from '@/lib/applicant/journey';
import { writingOffersQuery } from '../../offers';
import { CallLine } from './CallLine';
import { DocsHero } from './DocsHero';
import { HaveList } from './HaveList';
import { OfferCards } from './OfferCards';
import { nextKind } from './tray';

/**
 * The documents tab without a contract. Design: "Scorize New User Dashboard v2" canvas
 * (DocumentsGuestCalm): one promise and one upload, your documents as one list (sent files inside
 * their row), the writing we offer as three quiet cards (form now, pay at its final submit), and
 * a one-line call request. Narrow and spacious on purpose.
 */
export function NewUserDocuments({ access }: { access: ApplicantAccess }) {
  const { data: files } = useSuspenseQuery(reviewDocumentsQuery);
  const { data: writing } = useSuspenseQuery(writingOffersQuery);

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-14 lg:gap-[72px]">
      <DocsHero next={nextKind(files)} />
      <HaveList files={files} />
      <OfferCards offers={writing.included ? [] : writing.offers} />
      <CallLine phone={access.phone} />
    </div>
  );
}
