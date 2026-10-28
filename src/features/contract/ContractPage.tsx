import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionLock } from '@/components/applicant/SectionLock';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { accessQuery, lockOf } from '@/lib/applicant/access';
import { contractQuery, type ContractData } from './api';
import { ContractAside } from './components/ContractAside';
import { ContractHero } from './components/ContractHero';
import { GuestContract } from './components/guest/GuestContract';
import { InstallmentsCard } from './components/InstallmentsCard';
import { ProfileCard } from './components/ProfileCard';
import { StartHero } from './components/StartHero';
import { WaitingCard } from './components/WaitingCard';
import { previewContract } from './preview';

/**
 * "Contract & payment". Design: canvas "Scorize New User Dashboard v2" (ContractActive,
 * ContractStarting, ContractGuest, ContractGuestSession, ContractOther):
 * - active: what is waiting for the applicant, the contract on the luxe card, instalments with the
 *   documents beside them, then their details
 * - approved and waiting for its prepayment (S46): the prepayment on the luxe card, then the plan
 * - no contract: what the tab holds after one, the two contracts as tickets (Turkey online, the
 *   full contract at the office), research interests and the questions before one (canvas
 *   "قرارداد و پرداخت: بدون قرارداد"
 * - ended, or in review without a prepayment: the lock banner over the contract (or a sample)
 */
export default function ContractPage() {
  const { t } = useTranslation('contract');
  const { data: access } = useSuspenseQuery(accessQuery);
  const { data } = useSuspenseQuery(contractQuery);
  // No applicant file (404, data null) is a guest, whatever the access says.
  const lock = lockOf(access, 'contract') ?? (data ? null : 'guest');
  const { prepayment } = access;
  const starting = lock === 'pending' && prepayment && data;

  const columns = (contract: ContractData) => (
    <>
      <PageColumns
        asideLabel={t('aside')}
        main={<InstallmentsCard contract={contract} />}
        aside={<ContractAside contract={contract} />}
      />
      <ProfileCard contract={contract} />
    </>
  );
  const body = (contract: ContractData) => (
    <>
      <ContractHero contract={contract} />
      {columns(contract)}
    </>
  );

  if (lock === 'guest')
    return (
      <PageStack spacing="wide">
        <PageHeader title={t('title')} subtitle={t('guest.subtitle')} />
        <GuestContract access={access} />
      </PageStack>
    );

  return (
    <PageStack spacing="wide">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {starting ? (
        <>
          <StartHero prepayment={prepayment} contract={data} />
          {columns({ ...data, status: 'pending' })}
        </>
      ) : !lock && data ? (
        <>
          <WaitingCard contract={data} />
          {body(data)}
        </>
      ) : (
        <SectionLock section="contract" lock={lock ?? 'guest'} access={access}>
          {lock === 'ended' && data ? body(data) : body(previewContract(t))}
        </SectionLock>
      )}
    </PageStack>
  );
}
