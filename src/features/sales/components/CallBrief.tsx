import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import { callBriefQuery } from '../api';

/**
 * What a seller should know before answering, in one line under the call strip: a consultation with
 * someone else first (who to ask), else the last contact; the rest (follow-up, unpaid bills) behind
 * "+n". `dark`: on the live strip; light once the call ended. Nothing to say: nothing shown.
 */
export function CallBrief({
  customer,
  live = true,
  dark = true,
}: {
  customer: number;
  live?: boolean;
  dark?: boolean;
}) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const { data } = useQuery(callBriefQuery(customer));
  if (!data) return null;
  const lines = [
    ...data.consultations_elsewhere.map((item) =>
      t('callBrief.elsewhere', {
        consultant: item.consultant,
        title: item.title,
        when: f.timeAgo(item.at),
      }),
    ),
    ...(data.last_contact
      ? [
          data.last_contact.notes
            ? t('callBrief.last', {
                when: f.timeAgo(data.last_contact.at),
                notes: data.last_contact.notes,
              })
            : t('callBrief.lastNoNotes', { when: f.timeAgo(data.last_contact.at) }),
        ]
      : []),
    ...(data.follow_up
      ? [
          t('callBrief.followUp', {
            when: data.follow_up.at.includes('T')
              ? t('callBrief.at', {
                  day: f.weekday(data.follow_up.at),
                  time: f.time(data.follow_up.at),
                })
              : f.weekday(data.follow_up.at),
            text: data.follow_up.text,
          }),
        ]
      : []),
    ...data.unpaid.map((payment) => t('callBrief.unpaid', { amount: f.number(payment.amount) })),
  ];
  if (!lines.length) return null;
  const shown = open ? lines : lines.slice(0, 1);
  const hidden = lines.length - shown.length;
  return (
    <section
      aria-label={t(live ? 'callBrief.title' : 'callBrief.glance')}
      className={`flex flex-col gap-1 rounded-xl px-3 py-2 text-xs leading-6 ${dark ? 'bg-hero-raised text-hero-current' : 'bg-warn-tint text-warn'}`}
    >
      {shown.map((line) => (
        <p key={line} className="m-0 line-clamp-2 break-words">
          {line}
        </p>
      ))}
      {(hidden > 0 || open) && lines.length > 1 && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="min-h-8 self-start font-semibold underline-offset-4 hover:underline"
        >
          {open ? t('callBrief.less') : t('callBrief.more', { n: f.number(hidden) })}
        </button>
      )}
    </section>
  );
}
