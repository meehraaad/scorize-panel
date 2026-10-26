import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EstimateFlow } from '@/components/applicant/estimate/EstimateFlow';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { consultationsQuery, splitSessions } from '@/lib/applicant/consultations';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { latestEstimateQuery } from '@/lib/applicant/estimate';
import { backgroundQuery, reviewDocumentsQuery } from '@/lib/applicant/journey';
import { useUser } from '@/lib/auth/session';
import { GuestSections, TurkeyCard } from '../GuestSections';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { ReadinessCard } from './ReadinessCard';
import { ReviewUploadCard } from './ReviewUploadCard';
import { SessionCard } from './SessionCard';
import { StartPaths } from './StartPaths';

/**
 * Home of an account without a contract: a journey toward one. Every block is a step that brings
 * a seller's call closer (docs/backend-changes.md H59, H60). Three moments, one page:
 * - first visit: the admission-chance quiz leads, then the ways to start
 * - after the quiz: how ready the case is, files for a free review, then the ways to start
 * - a booked consultation: the session and what to fill before it lead
 * Design: "Scorize New User Dashboard" canvas (Main, FirstVisit, UpcomingConsult).
 */
export function NewUserHome({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('home');
  const user = useUser();
  const { data: estimate } = useSuspenseQuery(latestEstimateQuery);
  const { data: files } = useSuspenseQuery(reviewDocumentsQuery);
  const { data: background } = useSuspenseQuery(backgroundQuery);
  const { data: sessions } = useSuspenseQuery(consultationsQuery);
  const { upcoming } = splitSessions(sessions.results);
  const next = upcoming[0];

  const quiz = <EstimateFlow key="quiz" phone={access.phone} detailsTo="/estimate" />;
  const readiness = (
    <ReadinessCard
      key="readiness"
      done={{
        estimate: estimate !== null,
        background: background.complete,
        files: files.length > 0,
        consult: sessions.results.length > 0,
      }}
    />
  );
  const upload = <ReviewUploadCard key="upload" files={files} />;
  const paths = <StartPaths key="paths" access={access} />;

  let blocks: ReactNode[];
  if (next)
    blocks = [
      <SessionCard key="session" session={next} backgroundComplete={background.complete} />,
      readiness,
      upload,
      paths,
      quiz,
    ];
  else if (estimate === null) blocks = [quiz, paths, readiness, upload];
  else blocks = [readiness, upload, paths, quiz];

  return (
    <PageStack spacing="wide">
      <PageHeader
        title={
          user.first_name ? t('guest.title', { name: user.first_name }) : t('guest.titleNoName')
        }
        subtitle={t(estimate === null && !next ? 'guest.estimate.text' : 'guest.journey')}
      />
      {ON_SERVER.turkey && access.turkey && <TurkeyCard step={access.turkey} />}
      {blocks}
      <GuestSections pending={false} />
    </PageStack>
  );
}
