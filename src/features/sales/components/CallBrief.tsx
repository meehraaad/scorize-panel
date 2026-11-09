import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { callBriefQuery } from '../api';

/**
 * "Before you answer": what a seller reads while a known customer's phone rings. Consultations with
 * someone else come first (who to ask), then the last contact, today's follow-up and unpaid bills.
 * Nothing to say: no box. Opened by hand (`live` false) it is the same box under "at a glance".
 */
export function CallBrief({ customer, live = true }: { customer: number; live?: boolean }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const { data } = useQuery(callBriefQuery(customer));
  if (!data) return null;
  const title = t(live ? 'callBrief.title' : 'callBrief.glance');
  const rows: { key: string; icon: IconName; text: string }[] = [
    ...(data.last_contact
      ? [
          {
            key: 'last',
            icon: 'chat' as const,
            text: data.last_contact.notes
              ? t('callBrief.last', {
                  when: f.timeAgo(data.last_contact.at),
                  notes: data.last_contact.notes,
                })
              : t('callBrief.lastNoNotes', { when: f.timeAgo(data.last_contact.at) }),
          },
        ]
      : []),
    ...(data.follow_up
      ? [
          {
            key: 'follow',
            icon: 'clock' as const,
            text: t('callBrief.followUp', {
              when: data.follow_up.at.includes('T')
                ? t('callBrief.at', {
                    day: f.weekday(data.follow_up.at),
                    time: f.time(data.follow_up.at),
                  })
                : f.weekday(data.follow_up.at),
              text: data.follow_up.text,
            }),
          },
        ]
      : []),
    ...data.unpaid.map((payment) => ({
      key: `unpaid-${String(payment.id)}`,
      icon: 'card' as const,
      text: t('callBrief.unpaid', { amount: f.number(payment.amount) }),
    })),
  ];
  if (!rows.length && !data.consultations_elsewhere.length) return null;
  return (
    <section
      aria-label={title}
      className="-mx-5 -mt-5 flex flex-col gap-2.5 border-b border-hair bg-row-highlight px-5 py-4"
    >
      <h3 className="m-0 text-xs font-bold text-primary-text">{title}</h3>
      {data.consultations_elsewhere.map((item) => (
        <p
          key={`${item.consultant}-${item.at}`}
          className="m-0 flex items-start gap-2.5 rounded-xl bg-warn-tint px-3 py-2 text-[13px] leading-6 text-warn"
        >
          <Icon name="user" size={16} className="mt-1 flex-none" />
          <span>
            {t('callBrief.elsewhere', {
              consultant: item.consultant,
              title: item.title,
              when: f.timeAgo(item.at),
            })}
          </span>
        </p>
      ))}
      {rows.map((row) => (
        <p key={row.key} className="m-0 flex items-start gap-2.5 text-[13px] leading-6">
          <Icon name={row.icon} size={16} className="mt-1 flex-none text-text-2" />
          <span className="min-w-0 break-words">{row.text}</span>
        </p>
      ))}
    </section>
  );
}
