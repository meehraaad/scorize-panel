import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageColumns, PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { accountQuery } from '@/lib/account/api';
import { ChannelsCard } from './components/ChannelsCard';
import { LoginCard } from './components/LoginCard';
import { NotificationsCard } from './components/NotificationsCard';
import { ReferralCard } from './components/ReferralCard';

/**
 * Account & notifications, shared by every panel (/account). Design: canvas V6 section 10
 * (AppAccount). The header's bell opens it at the notifications.
 */
export default function AccountPage() {
  const { t } = useTranslation('account');
  const { data } = useSuspenseQuery(accountQuery);
  // Asked when the page opened unanswered; stays for this visit so its thank-you shows.
  const [askReferral] = useState(data.referral === null);
  return (
    <PageStack>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <PageColumns
        asideLabel={t('login.title')}
        main={<NotificationsCard />}
        aside={
          <>
            <ChannelsCard account={data} />
            <LoginCard account={data} />
            {askReferral && <ReferralCard />}
          </>
        }
      />
    </PageStack>
  );
}
