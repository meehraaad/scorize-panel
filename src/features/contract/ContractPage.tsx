import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionLock } from '@/components/applicant/SectionLock';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { accessQuery, lockOf } from '@/lib/applicant/access';
import { contractQuery, type ContractData } from './api';
import { ContractAside } from './components/ContractAside';
import { ContractHero } from './components/ContractHero';
import { InstallmentsCard } from './components/InstallmentsCard';
import { ProfileCard } from './components/ProfileCard';
import { StartCard } from './components/StartCard';
import { previewContract } from './preview';

/**
 * "Contract & payment". Design: canvas V6 section 7 "قرارداد و پرداخت" (AppContract); without an
 * approved contract, the locked preview of canvas V7 section 7. An approved contract waiting for its
 * prepayment (S46) shows what is left to start the case, above the contract itself.
 */
export default function ContractPage() {
  const { t } = useTranslation('contract');
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data } = useSuspenseQuery(contractQuery);
  // No applicant file (404, data null) is a guest, whatever the access says.
  const lock = lockOf(access, 'contract') ?? (data ? null : 'guest');
  const { prepayment } = access;
  const starting = lock === 'pending' && prepayment && data;

  const body = (contract: ContractData) => (
    <>
      <ContractHero contract={contract} />
      <PageColumns
        asideLabel={t('aside')}
        main={
          <>
            <InstallmentsCard contract={contract} />
            <ProfileCard contract={contract} />
          </>
        }
        aside={<ContractAside contract={contract} />}
      />
    </>
  );

  return (
    <PageStack>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {starting ? (
        <>
          <StartCard prepayment={prepayment} />
          {body({ ...data, status: 'pending' })}
        </>
      ) : !lock && data ? (
        body(data)
      ) : (
        <SectionLock section="contract" lock={lock ?? 'guest'} access={access}>
          {lock === 'ended' && data ? body(data) : body(previewContract(t))}
        </SectionLock>
      )}
    </PageStack>
  );
}
