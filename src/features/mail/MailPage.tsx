import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { BotRulesForm } from './components/BotRulesForm';
import { MailboxList } from './components/MailboxList';
import { NewMailboxDialog } from './components/NewMailboxDialog';
import { ServerCards } from './components/ServerCards';
import { SuppressedList } from './components/SuppressedList';

type View = 'mailboxes' | 'rules' | 'suppressed';

/**
 * The applicants' mailboxes on our own mail servers (PersiaMail, GradNexus), for managers: the
 * servers' health, the mailboxes (create, new password, quota, link, delete), the email bot's
 * rules and the addresses no bot writes to again. Django: `api/mail/v1/`.
 */
export default function MailPage() {
  const { t } = useTranslation('mail');
  const [view, setView] = useState<View>('mailboxes');
  const [creating, setCreating] = useState(false);

  return (
    <PageStack>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} />
            {t('list.add')}
          </Button>
        }
      />
      <ServerCards />
      <FilterTabs
        label={t('views')}
        value={view}
        onChange={setView}
        options={[
          { value: 'mailboxes', label: t('view.mailboxes') },
          { value: 'rules', label: t('view.rules') },
          { value: 'suppressed', label: t('view.suppressed') },
        ]}
      />
      {view === 'mailboxes' && <MailboxList />}
      {view === 'rules' && <BotRulesForm />}
      {view === 'suppressed' && <SuppressedList />}
      {creating && <NewMailboxDialog onClose={() => setCreating(false)} />}
    </PageStack>
  );
}
