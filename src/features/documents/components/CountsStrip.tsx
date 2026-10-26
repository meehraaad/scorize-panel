import { useTranslation } from 'react-i18next';
import { useFormat } from '@/lib/i18n/useFormat';
import type { DocumentsData } from '../api';

/**
 * The case's documents in four counts, each a count of real rows (no percentages, no estimates):
 * what waits on the applicant, what the supervisor is checking, what is approved, and the writing
 * delivered.
 */
export function CountsStrip({ data }: { data: DocumentsData }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const own = data.files.filter((file) => file.source === 'me');
  const writing = data.writing ?? [];
  const forms = writing.filter((order) => order.step === 'form').length;
  const drafts = writing.filter((order) => order.draft_waiting).length;
  const waiting = data.required.length + forms + drafts;
  const delivered = writing.filter((order) => order.step === 'ready').length;

  const counts = [
    {
      id: 'waiting',
      label: t('counts.waiting'),
      n: f.number(waiting),
      hint: t('counts.waitingHint', {
        documents: f.number(data.required.length),
        forms: f.number(forms),
        drafts: f.number(drafts),
      }),
      tone: 'bg-warn-tint text-warn',
    },
    {
      id: 'review',
      label: t('counts.review'),
      n: f.number(own.filter((file) => file.state === 'review').length),
      hint: t('counts.reviewHint'),
      tone: 'bg-info-tint text-info',
    },
    {
      id: 'approved',
      label: t('counts.approved'),
      n: f.number(own.filter((file) => file.state === 'approved').length),
      hint: t('counts.approvedHint'),
      tone: 'bg-good-tint text-good',
    },
    ...(writing.length > 0
      ? [
          {
            id: 'delivered',
            label: t('counts.delivered'),
            n: t('counts.ofTotal', { n: f.number(delivered), total: f.number(writing.length) }),
            hint: t('counts.deliveredHint'),
            tone: 'bg-tint text-primary-text',
          },
        ]
      : []),
  ];

  return (
    <ul
      aria-label={t('counts.label')}
      className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4"
    >
      {counts.map((count) => (
        <li
          key={count.id}
          className="flex items-center gap-3.5 rounded-[20px] bg-surface px-4 py-4 shadow-panel lg:px-5"
        >
          <span
            className={`flex h-12 min-w-12 flex-none items-center justify-center rounded-[14px] px-2 text-[22px] font-black ${count.tone}`}
          >
            {count.n}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-bold">{count.label}</span>
            <span className="text-[12px] leading-5 text-text-2">{count.hint}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
