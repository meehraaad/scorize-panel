import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionLock } from '@/components/applicant/SectionLock';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { accessQuery, lockOf } from '@/lib/applicant/access';
import { applicationsQuery, type ApplicationsData } from './api';
import { ApplicationsList } from './components/ApplicationsList';
import { ProfessorEmails } from './components/ProfessorEmails';
import { StatsGrid } from './components/StatsGrid';
import { VisaResults } from './components/VisaResults';
import { previewApplications } from './preview';
import { ON_SERVER } from '@/lib/applicant/onServer';

/**
 * "Applications & results". Design: canvas V6 "اپلای‌ها و نتایج" (AppApplications); without a
 * contract or the admission service, the locked preview of canvas V7 section 4.
 */
export default function ApplicationsPage() {
  const { t } = useTranslation('applications');
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data } = useSuspenseQuery(applicationsQuery);
  // No applicant file (404, data null) is a guest, whatever the access says.
  const lock = lockOf(access, 'applications') ?? (data ? null : 'guest');

  const body = (results: ApplicationsData, emails: boolean) => (
    <>
      <StatsGrid data={results} />
      <ApplicationsList applications={results.results} />
      {results.visa && <VisaResults results={results.visa} />}
      {emails && ON_SERVER.professorEmails && <ProfessorEmails />}
    </>
  );

  return (
    <PageStack spacing="wide">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {!lock && data ? (
        body(data, true)
      ) : (
        <SectionLock section="applications" lock={lock ?? 'guest'} access={access}>
          {lock === 'ended' && data ? body(data, true) : body(previewApplications(), false)}
        </SectionLock>
      )}
    </PageStack>
  );
}
