import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EstimateFlow } from '@/components/applicant/estimate/EstimateFlow';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { consultationsQuery, recentSession, splitSessions } from '@/lib/applicant/consultations';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { latestEstimateQuery } from '@/lib/applicant/estimate';
import {
  backgroundQuery,
  reviewDocumentsQuery,
  startQuery,
  type ReviewKind,
} from '@/lib/applicant/journey';
import { useUser } from '@/lib/auth/session';
import { GuestSections, TurkeyCard } from '../GuestSections';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { AfterSessionCard } from './AfterSessionCard';
import { AfterUpload } from './AfterUpload';
import { TalkCard } from './CallTimeCard';
import { PastSessionCard } from './PastSessionCard';
import { ConsultantCard, SimilarCard } from './PeopleCards';
import { ReadinessCard } from './ReadinessCard';
import { ReviewUploadCard } from './ReviewUploadCard';
import { SessionCard } from './SessionCard';
import { SessionTopics } from './SessionTopics';
import { StartPaths } from './StartPaths';

/**
 * Home of an account without a contract: a journey toward one. Every block is a step that brings
 * a seller's call closer (docs/backend-changes.md H59, H60, H63, H64). Moments, one page:
 * - first visit: the admission-chance quiz leads (its result's shape locked beside it), then a
 *   call at a time they pick, then the ways to start
 * - after the quiz: how ready the case is, files for a free review, then the ways to start
 * - after the first file: it arrived, a time for the session, what Turkey still needs
 * - a booked consultation: the session (countdown, calendar), what it covers, what to fill before it
 * - after a session (within a month): a short survey about it leads
 * - long after a session: a short card about it, then the ways to start (no readiness checklist:
 *   its steps lead to the session they already had)
 * Their own seller and admissions of people like them close every moment but the first.
 * On phones the quiz is one short card that opens its questions in a bottom sheet.
 * Design: "Scorize New User Dashboard v2" canvas (Main, FirstVisit, AfterUpload, UpcomingConsult).
 */
export function NewUserHome({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('home');
  const user = useUser();
  const { data: estimate } = useSuspenseQuery(latestEstimateQuery);
  const { data: files } = useSuspenseQuery(reviewDocumentsQuery);
  const { data: background } = useSuspenseQuery(backgroundQuery);
  const { data: sessions } = useSuspenseQuery(consultationsQuery);
  const { data: offers } = useSuspenseQuery(startQuery);
  const [kind, setKind] = useState<ReviewKind>('transcript');
  const { upcoming, past } = splitSessions(sessions.results);
  const next = upcoming[0];
  // The last session, while it is recent: the survey about it (or the thanks for it) leads.
  const held = recentSession(sessions.results);
  const consulted = sessions.results.length > 0;
  // Nothing answered, sent or booked yet.
  const firstVisit = estimate === null && files.length === 0 && !consulted;

  const quiz = (
    <EstimateFlow
      key="quiz"
      phone={access.phone}
      detailsTo="/estimate"
      teaser={firstVisit}
      sheetOnPhone
    />
  );
  const readiness = (
    <ReadinessCard
      key="readiness"
      done={{
        estimate: estimate !== null,
        background: background.complete,
        files: files.length > 0,
        consult: consulted,
      }}
    />
  );
  const upload = <ReviewUploadCard key="upload" files={files} kind={kind} onKind={setKind} />;
  const paths = <StartPaths key="paths" access={access} offers={offers} />;
  const people = [
    offers.consultant && (
      <ConsultantCard key="consultant" consultant={offers.consultant} access={access} />
    ),
    estimate && <SimilarCard key="similar" estimate={estimate} />,
  ];
  // The Turkey checklist's "upload passport": the upload card, on that kind of file.
  const uploadKind = (picked: ReviewKind) => {
    setKind(picked);
    document.getElementById('review-upload')?.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('review-file')?.focus({ preventScroll: true });
  };

  let blocks: ReactNode[];
  if (next)
    blocks = [
      <SessionCard key="session" session={next} backgroundComplete={background.complete} />,
      <SessionTopics key="topics" />,
      readiness,
      upload,
      paths,
      quiz,
      ...people,
    ];
  else if (held)
    blocks = [
      <AfterSessionCard key="after" session={held} access={access} />,
      readiness,
      upload,
      paths,
      quiz,
      ...people,
    ];
  else if (past[0])
    blocks = [
      <PastSessionCard key="past" session={past[0]} access={access} />,
      paths,
      quiz,
      upload,
      ...people,
    ];
  else if (firstVisit)
    blocks = [
      quiz,
      <TalkCard key="call" access={access} offers={offers} />,
      paths,
      readiness,
      upload,
    ];
  else if (files.length > 0 && !consulted)
    blocks = [
      <AfterUpload
        key="received"
        files={files}
        offers={offers}
        phone={access.phone}
        onUpload={uploadKind}
      />,
      readiness,
      upload,
      paths,
      quiz,
      ...people,
    ];
  else blocks = [readiness, upload, paths, quiz, ...people];

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
