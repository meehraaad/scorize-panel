import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/Filters';
import { Icon } from '@/components/ui/Icon';
import { PageStack } from '@/components/ui/PageColumns';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/Skeleton';
import {
  FIRST_READY_KIND,
  READY_TABS,
  readyMessagesQuery,
  type ReadyTab,
  type ReadyMessage,
} from './api';
import { ReadyMessageDialog } from './components/ReadyMessageDialog';

/**
 * Making ready messages: the sellers' (WhatsApp, Telegram and SMS from a customer's page), the
 * ticket replies (the tickets' composer), or one for both. Each fills in its variables (the
 * customer's and the sender's names, the customer's session, the last summary…) for the customer.
 */
export default function ReadyMessagesPage() {
  const { t } = useTranslation('messages');
  const [kind, setKind] = useState<ReadyTab>(FIRST_READY_KIND);
  const [open, setOpen] = useState<ReadyMessage | 'new' | null>(null);
  const { data } = useQuery(readyMessagesQuery(kind));

  return (
    <PageStack>
      <PageHeader
        title={t('ready.title')}
        subtitle={t('ready.subtitle')}
        actions={
          <Button onClick={() => setOpen('new')}>
            <Icon name="plus" size={18} />
            {t('ready.add')}
          </Button>
        }
      />
      <FilterTabs
        label={t('ready.kinds')}
        value={kind}
        onChange={setKind}
        options={READY_TABS.map((value) => ({ value, label: t(`ready.kind.${value}`) }))}
      />
      <Card aria-label={t(`ready.kind.${kind}`)} aria-busy={!data}>
        <p className="m-0 px-5 pt-5 text-sm leading-7 text-text-2 lg:px-8">
          {t(`ready.where.${kind}`)}
        </p>
        {!data ? (
          <SkeletonRows rows={4} />
        ) : data.length === 0 ? (
          <EmptyState variant="padded">{t('ready.empty')}</EmptyState>
        ) : (
          <ul className="m-0 list-none p-0 pt-3">
            {data.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => setOpen(message)}
                  aria-label={t('ready.open', { title: message.title })}
                  className="flex w-full items-center gap-4 px-5 py-3.5 text-start shadow-[inset_0_1px_0_var(--hair)] hover:bg-canvas lg:px-8"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{message.title}</span>
                    <span className="truncate text-[13px] text-text-2">{message.text}</span>
                  </span>
                  {message.kind === 'both' && (
                    <Chip tone="info" small>
                      {t(`ready.alsoIn.${kind}`)}
                    </Chip>
                  )}
                  <Chip tone={message.is_active ? 'good' : 'warn'} dot small>
                    {t(message.is_active ? 'ready.on' : 'ready.off')}
                  </Chip>
                  <Icon name="chevronEnd" size={18} className="text-text-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="h-3" />
      </Card>
      {open && (
        <ReadyMessageDialog
          tab={kind}
          message={open === 'new' ? null : open}
          onClose={() => setOpen(null)}
        />
      )}
    </PageStack>
  );
}
