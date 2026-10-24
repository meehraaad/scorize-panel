import { useSuspenseQuery } from '@tanstack/react-query';
import { Outlet } from 'react-router';
import { gatesQuery } from '@/lib/applicant/gates';
import { InactiveGate } from './components/InactiveGate';
import { ProfileGate } from './components/ProfileGate';
import { SurveyGate } from './components/SurveyGate';
import { TermsGate } from './components/TermsGate';

/**
 * Wraps the applicant panel's pages. When the server says something must happen first (canvas V6
 * section 8), that step shows in place of the page: an inactive panel, then the terms, then the
 * missing profile details, then supervisor surveys. Each one clears as it is answered.
 */
export default function GatesLayout() {
  const { data } = useSuspenseQuery(gatesQuery);
  if (data.inactive) return <InactiveGate inactive={data.inactive} />;
  if (data.terms) return <TermsGate terms={data.terms} />;
  if (data.profile) return <ProfileGate profile={data.profile} />;
  if (data.surveys.length > 0) return <SurveyGate surveys={data.surveys} />;
  return <Outlet />;
}
