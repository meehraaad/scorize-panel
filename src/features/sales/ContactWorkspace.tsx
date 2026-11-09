import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { FloatingPanel } from '@/components/ui/FloatingPanel';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { SkeletonRows } from '@/components/ui/Skeleton';
import {
  activateContactDraft,
  removeContactDraft,
  nameContactDraft,
  useContactDrafts,
  activateUnknownCall,
  type ContactDraft,
} from '@/lib/sales/contactDrafts';
import { customerQuery } from './api';
import { LogDialog } from './components/LogDialog';
import { CallStatus } from './components/CallStatus';
import { UnknownCallPanel } from './components/UnknownCallPanel';

export default function ContactWorkspace() {
  const { t } = useTranslation('sales');
  const { drafts, active, unknownCalls, activeUnknown } = useContactDrafts();
  const current = drafts.find((draft) => draft.key === active);
  const unknown = unknownCalls.find((call) => call.id === activeUnknown);
  return (
    <>
      {drafts.map((draft) => (
        <div key={draft.key} hidden={draft.key !== active}>
          <ContactForm draft={draft} active={draft.key === active} />
        </div>
      ))}
      {unknown && <UnknownCallPanel key={unknown.id} call={unknown} />}
      <aside
        aria-label={t('contactDraft.tray')}
        className={`fixed start-3 end-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 flex max-h-32 flex-wrap gap-2 overflow-y-auto lg:start-5 lg:end-auto lg:bottom-5 lg:max-w-[calc(100vw-490px)] ${current || unknown ? 'hidden lg:flex' : ''}`}
      >
        {drafts
          .filter((draft) => draft.key !== active)
          .map((draft) => {
            const live = !!draft.call && draft.call.ended_at === null;
            return (
              <Button
                key={draft.key}
                variant={live ? 'dark' : 'outline'}
                onClick={() => activateContactDraft(draft.key)}
                aria-label={t('contactDraft.resume', { name: draft.name })}
                className={`max-w-full shadow-panel ${live ? '' : 'bg-warn-tint'}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 flex-none rounded-full ${live ? 'bg-live' : 'bg-warn'}`}
                />
                <Icon name={draft.start.channel === 'meeting' ? 'calendar' : 'phone'} size={18} />
                <span className="truncate">
                  {live ? draft.name : t('contactDraft.unsaved', { name: draft.name })}
                </span>
                {draft.call && <CallStatus call={draft.call} compact />}
              </Button>
            );
          })}
        {unknownCalls
          .filter((call) => call.id !== activeUnknown)
          .map((call) => (
            <Button
              key={call.id}
              variant={call.ended_at === null ? 'dark' : 'outline'}
              onClick={() => activateUnknownCall(call.id)}
              aria-label={t('phoneCall.resumeUnknown', { phone: call.phone })}
              className="shadow-panel"
            >
              <span
                aria-hidden="true"
                className={`size-2.5 flex-none rounded-full ${
                  call.ended_at === null
                    ? 'bg-live'
                    : call.status === 'missed'
                      ? 'bg-danger'
                      : 'bg-text-3'
                }`}
              />
              <Icon name="phone" size={18} />
              <span>
                {t(call.status === 'missed' ? 'callStrip.missedTitle' : 'phoneCall.unknown')}
              </span>
              <CallStatus call={call} compact />
            </Button>
          ))}
      </aside>
    </>
  );
}

function ContactForm({ draft, active }: { draft: ContactDraft; active: boolean }) {
  const { t } = useTranslation('sales');
  const customer = useQuery(customerQuery(draft.customer));
  const [discarding, setDiscarding] = useState(false);
  useEffect(() => {
    if (customer.data && customer.data.name !== draft.name)
      nameContactDraft(draft.key, customer.data.name);
  }, [customer.data, draft.key, draft.name]);
  const minimize = () => activateContactDraft(null);
  if (customer.data)
    return (
      <LogDialog
        active={active}
        customer={customer.data}
        draft={draft}
        onClose={minimize}
        onSaved={() => removeContactDraft(draft.key)}
        onDiscard={() => removeContactDraft(draft.key)}
      />
    );
  return (
    <FloatingPanel
      active={active}
      title={t('customer.logDialog.title', { name: draft.name })}
      closeLabel={t('contactDraft.minimize')}
      onClose={minimize}
    >
      {customer.isError ? (
        <Notice tone="info">
          <p>{t('error')}</p>
          <Button
            variant="outline"
            onClick={() => {
              void customer.refetch();
            }}
          >
            {t('contactDraft.retry')}
          </Button>
          {discarding ? (
            <>
              <p>{t('contactDraft.discardConfirm')}</p>
              <Button variant="outline" onClick={() => removeContactDraft(draft.key)}>
                {t('contactDraft.discard')}
              </Button>
              <Button variant="outline" onClick={() => setDiscarding(false)}>
                {t('contactDraft.keep')}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setDiscarding(true)}>
              {t('contactDraft.discard')}
            </Button>
          )}
        </Notice>
      ) : (
        <SkeletonRows rows={4} />
      )}
    </FloatingPanel>
  );
}
