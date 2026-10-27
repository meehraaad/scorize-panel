import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionLock } from '@/components/applicant/SectionLock';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { InterestsCard } from '@/components/applicant/InterestsCard';
import { documentsQuery } from '@/lib/applicant/documents';
import { useSaveInterests } from '@/lib/applicant/interests';
import { accessQuery, lockOf } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { applicationsQuery, type ApplicationsData } from './api';
import { AdmissionCards } from './components/AdmissionCards';
import { ApprovalCards } from './components/ApprovalCards';
import { HowItWorks } from './components/HowItWorks';
import { Lanes } from './components/Lanes';
import { LockedPreview } from './components/LockedPreview';
import { NoApplications } from './components/NoApplications';
import { ProfessorEmails } from './components/ProfessorEmails';
import { QuotaCard } from './components/QuotaCard';
import { VisaResults } from './components/VisaResults';
import { GuestApplications } from './components/guest/GuestApplications';
import { inPlace, isNewAdmission } from './groups';

/**
 * "Applications & results". Design: canvas "New user dashboard v2", row «تب اپلای‌ها و نتایج»
 * (ApplyActive, ApplyResults, ApplyEmpty, ApplyGuest), and canvas "تب اپلای‌ها و نتایج". Without a
 * contract, the page sells the service (`GuestApplications`); without the admission service or
 * after the contract, the page's layout (no sample data) under the lock banner.
 */
export default function ApplicationsPage() {
  const { t } = useTranslation('applications');
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data } = useSuspenseQuery(applicationsQuery);
  // No applicant file (404, data null) is a guest, whatever the access says.
  const lock = lockOf(access, 'applications') ?? (data ? null : 'guest');

  return (
    <PageStack spacing="wide">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {!lock && data ? (
        <Case data={data} />
      ) : lock === 'guest' ? (
        <GuestApplications access={access} />
      ) : (
        <>
          <SectionLock section="applications" lock={lock ?? 'guest'} access={access}>
            {lock === 'ended' && data ? <Case data={data} /> : <LockedPreview />}
          </SectionLock>
          {lock !== 'ended' && <HowItWorks />}
        </>
      )}
    </PageStack>
  );
}

function Case({ data }: { data: ApplicationsData }) {
  const applications = data.results;
  const { data: docs } = useSuspenseQuery(documentsQuery);
  const saveInterests = useSaveInterests();
  return (
    <>
      {applications.length === 0 ? (
        <>
          <NoApplications data={data} />
          <HowItWorks />
        </>
      ) : (
        <>
          <AdmissionCards items={applications.filter(isNewAdmission)} />
          <QuotaCard data={data} />
          <ApprovalCards items={inPlace(applications, 'awaiting')} />
          <Lanes applications={applications} />
        </>
      )}
      {data.visa && <VisaResults results={data.visa} />}
      {docs && (
        <InterestsCard id="apps-interests" interests={docs.interests} save={saveInterests} />
      )}
      {ON_SERVER.professorEmails && <ProfessorEmails />}
    </>
  );
}
