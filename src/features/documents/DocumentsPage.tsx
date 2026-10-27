import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionLock } from '@/components/applicant/SectionLock';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { accessQuery, lockOf } from '@/lib/applicant/access';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { documentsQuery, type DocumentsData } from './api';
import { CountsStrip } from './components/CountsStrip';
import { FilesCard } from './components/FilesCard';
import { InterestsCard } from '@/components/applicant/InterestsCard';
import { useSaveInterests } from '@/lib/applicant/interests';
import { NewUserDocuments } from './components/newUser/NewUserDocuments';
import { UploadCard } from './components/UploadCard';
import { WaitingCard } from './components/WaitingCard';
import { WritingCard } from './components/WritingCard';
import { WritingUpsell } from './components/WritingUpsell';
import { previewDocuments } from './preview';

/**
 * "Documents & writing". Design: canvas V6 "مدارک و نگارش" (AppDocuments), reworked in the
 * "Scorize New User Dashboard v2" canvas (Documents): what waits on the applicant (one card each),
 * then two lanes, their uploads and the team's writing. Without a contract, the locked preview of
 * canvas V7 section 5, or (once Django offers writing) the new user's tab: documents to send for a
 * free review next to the writing we offer.
 */
export default function DocumentsPage() {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const saveInterests = useSaveInterests();
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data } = useSuspenseQuery(documentsQuery);
  // No applicant file (404, data null) is a guest, whatever the access says.
  const lock = lockOf(access, 'documents') ?? (data ? null : 'guest');

  // Two lanes: what the applicant sends (main), what the team writes (aside). What is waiting on
  // the applicant comes first.
  const body = (docs: DocumentsData) => (
    <>
      <WaitingCard data={docs} />
      <PageColumns
        asideLabel={t('aside')}
        main={
          <>
            <UploadCard data={docs} />
            <FilesCard files={docs.files.filter((file) => file.source === 'me')} />
          </>
        }
        aside={
          <>
            {docs.writing && docs.writing.length > 0 ? (
              <WritingCard orders={docs.writing} />
            ) : (
              docs.writing === null && !lock && <WritingUpsell phone={access.phone} />
            )}
            <FilesCard lane="team" files={docs.files.filter((file) => file.source === 'team')} />
            <InterestsCard id="docs-interests" interests={docs.interests} save={saveInterests} />
          </>
        }
      />
    </>
  );

  if (lock === 'guest' && ON_SERVER.writingOffers)
    return (
      <PageStack>
        <PageHeader title={t('title')} />
        <NewUserDocuments access={access} />
      </PageStack>
    );

  if (lock || !data)
    return (
      <PageStack>
        <PageHeader title={t('title')} />
        <SectionLock section="documents" lock={lock ?? 'guest'} access={access}>
          {lock === 'ended' && data ? body(data) : body(previewDocuments(t))}
        </SectionLock>
      </PageStack>
    );

  const subtitle = [
    t('summary', {
      uploaded: f.number(data.progress.uploaded),
      required: f.number(data.progress.required),
    }),
    data.required.length > 0 && t('summaryPending', { n: f.number(data.required.length) }),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <PageStack>
      <PageHeader title={t('title')} subtitle={subtitle} />
      <CountsStrip data={data} />
      {body(data)}
    </PageStack>
  );
}
