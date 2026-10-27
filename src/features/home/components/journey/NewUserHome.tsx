import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EstimateFlow } from '@/components/applicant/estimate/EstimateFlow';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { consultationsQuery, recentSession, splitSessions } from '@/lib/applicant/consultations';
import type { ApplicantAccess } from '@/lib/applicant/access';
import { latestEstimateQuery } from '@/lib/applicant/estimate';
import { backgroundQuery, startQuery } from '@/lib/applicant/journey';
import { useUser } from '@/lib/auth/session';
import { TurkeyCard } from '../TurkeyCard';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { SessionsCard } from '../SessionsCard';
import { AfterSessionCard } from './AfterSessionCard';
import { TalkCard } from './CallTimeCard';
import { PastSessionCard } from './PastSessionCard';
import { ConsultantCard, SimilarCard } from './PeopleCards';
import { SessionCard } from './SessionCard';
import { SessionTopics } from './SessionTopics';
import { StartPaths } from './StartPaths';

/**
 * Home of an account without a contract: a journey toward one. Every block is a step that brings
 * a seller's call closer (docs/backend-changes.md H59, H60, H63, H64). Moments, one page:
 * - first visit: the admission-chance quiz leads (its result's shape locked beside it), then a
 *   call at a time they pick, then the ways to start
 * - after the quiz, nothing booked: the consultation card leads, then the ways to start
 * - a booked consultation: the session (countdown, calendar, what to fill before it), then what
 *   it covers (desktop only)
 * - after a session (within a month): what the consultant wrote, the next step and a short survey
 * - long after a session: a short card about it, then the ways to start
 * With more than one session, every session follows the first block (the consultations page's
 * place: "مشاوره در صفحه اصلی پنل" canvas).
 * Their own seller and admissions of people like them close every moment but the first.
 * On phones the quiz is one short card that opens its questions in a bottom sheet.
 * Design: "Scorize New User Dashboard v2" canvas (Main, FirstVisit, UpcomingConsult).
 */
export function NewUserHome({ access }: { access: ApplicantAccess }) {
  const { t } = useTranslation('home');
  const user = useUser();
  const { data: estimate } = useSuspenseQuery(latestEstimateQuery);
  const { data: background } = useSuspenseQuery(backgroundQuery);
  const { data: sessions } = useSuspenseQuery(consultationsQuery);
  const { data: offers } = useSuspenseQuery(startQuery);
  const { upcoming, past } = splitSessions(sessions.results);
  const next = upcoming[0];
  // The last session, while it is recent: the survey about it (or the thanks for it) leads.
  const held = recentSession(sessions.results);
  const consulted = sessions.results.length > 0;
  // Nothing answered or booked yet.
  const firstVisit = estimate === null && !consulted;

  const quiz = <EstimateFlow key="quiz" phone={access.phone} detailsTo="/estimate" sheetOnPhone />;
  const paths = <StartPaths key="paths" access={access} offers={offers} />;
  const people = [
    offers.consultant && (
      <ConsultantCard key="consultant" consultant={offers.consultant} access={access} />
    ),
    estimate && <SimilarCard key="similar" estimate={estimate} />,
  ];

  const history = <SessionsCard key="sessions" />;

  let blocks: ReactNode[];
  if (next)
    blocks = [
      <SessionCard
        key="session"
        session={next}
        backgroundComplete={background.complete}
        access={access}
      />,
      past.length > 0 ? history : <SessionTopics key="topics" />,
      paths,
      quiz,
      ...people,
    ];
  else if (held)
    blocks = [
      <AfterSessionCard key="after" session={held} access={access} />,
      history,
      paths,
      quiz,
      ...people,
    ];
  else if (past[0])
    blocks = [
      <PastSessionCard key="past" session={past[0]} access={access} />,
      history,
      paths,
      quiz,
      ...people,
    ];
  else if (firstVisit)
    blocks = [quiz, <TalkCard key="call" access={access} offers={offers} />, paths];
  // Nothing booked yet: the consultation card leads.
  else blocks = [<TalkCard key="call" access={access} offers={offers} />, paths, quiz, ...people];

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
    </PageStack>
  );
}
