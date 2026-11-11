import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useUser } from '@/lib/auth/session';
import { fillReady, ticketRepliesQuery } from '@/lib/tickets/readyReplies';

/**
 * Staff's ready ticket replies (made in the messages section), over the composer: "Ready message"
 * opens the list, and a pick puts its text in the box with the names filled in. Loaded only when
 * opened.
 */
export function ReadyReplies({
  customer,
  onPick,
}: {
  /** The applicant's name, for `{customer}`; left as it is when unknown. */
  customer: string | undefined;
  onPick: (text: string) => void;
}) {
  const { t } = useTranslation('tickets');
  const user = useUser();
  const [open, setOpen] = useState(false);
  const { data, isError } = useQuery({ ...ticketRepliesQuery, enabled: open });
  const seller = user.staff?.full_name ?? `${user.first_name} ${user.last_name}`.trim();

  return (
    <div className="flex flex-col gap-2 bg-surface px-3 pt-2 shadow-[inset_0_1px_0_var(--hair)] lg:px-7">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-2 text-[13px] font-medium text-primary-text hover:bg-tint"
      >
        <Icon name="chat" size={16} />
        {t('ready.button')}
        <Icon name="chevronDown" size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div role="group" aria-label={t('ready.label')} className="flex flex-wrap gap-2 pb-1">
          {isError ? (
            <span className="text-[13px] text-danger">{t('ready.error')}</span>
          ) : !data ? (
            <span className="text-[13px] text-text-2">{t('ready.loading')}</span>
          ) : data.length === 0 ? (
            <span className="text-[13px] text-text-2">{t('ready.none')}</span>
          ) : (
            data.map((reply) => (
              <button
                key={reply.id}
                type="button"
                onClick={() => {
                  onPick(fillReady(reply.text, { customer: customer ?? '{customer}', seller }));
                  setOpen(false);
                }}
                className="inline-flex min-h-11 items-center rounded-full bg-tint px-3.5 text-[13px] font-medium text-primary-text hover:brightness-95"
              >
                {reply.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
