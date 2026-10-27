import { useSuspenseQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { gatesQuery } from '@/lib/applicant/gates';
import { InactiveGate } from './components/InactiveGate';
import { ProfileGate } from './components/ProfileGate';
import { SurveyGate } from './components/SurveyGate';
import { TermsGate } from './components/TermsGate';

// Its own chunk: it loads its dictionary and data, and shows nothing until they are in.
const ActivityBox = lazy(() => import('@/components/applicant/activities/ActivityBox'));

/**
 * Wraps the applicant panel's pages. When the server says something must happen first (canvas V6
 * section 8), that step shows in place of the page: an inactive panel, then the terms, then the
 * missing profile details, then supervisor surveys. Each one clears as it is answered. With no
 * gate, the page shows with the to-do box over it (AC1–AC7).
 */
export default function GatesLayout() {
  const { data } = useSuspenseQuery(gatesQuery);
  if (data.inactive) return <InactiveGate inactive={data.inactive} />;
  if (data.terms) return <TermsGate terms={data.terms} />;
  if (data.profile) return <ProfileGate profile={data.profile} />;
  if (data.surveys.length > 0) return <SurveyGate surveys={data.surveys} />;
  return (
    <>
      <Outlet />
      {ON_SERVER.activities && (
        <Suspense fallback={null}>
          <ActivityBox />
        </Suspense>
      )}
    </>
  );
}
