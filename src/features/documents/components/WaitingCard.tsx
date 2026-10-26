import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import type { DocumentsData } from '../api';
import { shownStep } from '../writing';

/** A deadline this close is shown in the danger colour. */
const URGENT_DAYS = 7;

const CARD = 'flex flex-col gap-2.5 rounded-[20px] bg-surface p-5 shadow-panel';

/**
 * What only the applicant can do now, above everything else, one card each: a document to upload
 * (with its deadline, or the supervisor's reason to send it again), a writing form to fill, a
 * draft to review. Nothing waiting: not shown. Design: "Scorize New User Dashboard v2" canvas,
 * Documents ("waiting for you").
 */
export function WaitingCard({ data }: { data: DocumentsData }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const orders = (data.writing ?? []).filter((order) => {
    const step = shownStep(order);
    return step === 'form' || step === 'review';
  });
  if (data.required.length === 0 && orders.length === 0) return null;

  const card = (
    key: string,
    chip: { tone: ChipTone; label: string } | null,
    kind: string,
    title: string,
    text: ReactNode,
    action: ReactNode,
  ) => (
    <li key={key} className={CARD}>
      <span className="flex items-center justify-between gap-2">
        {chip ? (
          <Chip tone={chip.tone} small>
            {chip.label}
          </Chip>
        ) : (
          <span />
        )}
        <span className="text-xs text-text-2">{kind}</span>
      </span>
      <h3 className="m-0 text-base font-bold">{title}</h3>
      {text}
      <div className="mt-auto pt-1">{action}</div>
    </li>
  );

  return (
    <section aria-labelledby="docs-waiting" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <h2 id="docs-waiting" className="m-0 font-display text-[22px] font-bold">
          {t('waiting.title')}
        </h2>
        <p className="m-0 text-sm text-text-2">{t('waiting.subtitle')}</p>
      </div>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {data.required.map((item) => {
          const days = item.deadline ? daysUntil(item.deadline) : null;
          return card(
            `doc-${String(item.id)}`,
            item.note
              ? { tone: 'danger', label: t('waiting.redo') }
              : days !== null
                ? {
                    tone: days <= URGENT_DAYS ? 'danger' : 'neutral',
                    label: t('waiting.daysLeft', { n: f.number(days) }),
                  }
                : null,
            t('waiting.kindUpload'),
            item.name,
            item.note ? (
              <p className="m-0 rounded-xl bg-canvas px-3 py-2 text-[13px] leading-6">
                <b>{t('waiting.supervisor')}</b> {item.note}
              </p>
            ) : (
              <p className="m-0 text-[13px] text-text-2">{t('waiting.uploadHint')}</p>
            ),
            <a
              href="#docs-required"
              className={buttonClass(item.note ? 'outline' : 'primary', 'w-full')}
            >
              {t(item.note ? 'waiting.reupload' : 'waiting.uploadOne', { name: item.name })}
            </a>,
          );
        })}
        {orders.map((order) => {
          const name = t(`writing.name.${order.type}`);
          const review = shownStep(order) === 'review';
          return card(
            `writing-${order.type}`,
            { tone: 'warn', label: t(review ? 'waiting.draftChip' : 'waiting.formChip') },
            t(review ? 'waiting.kindDraft' : 'waiting.kindForm'),
            review ? t('waiting.draft', { name }) : t('waiting.form', { name }),
            <p className="m-0 text-[13px] text-text-2">
              {t(review ? 'waiting.draftHint' : 'waiting.formHint')}
            </p>,
            <Link
              to={review ? `/tickets/writing/${order.type}` : `/documents/${order.type}`}
              className={buttonClass('outline', 'w-full')}
            >
              {t(review ? 'waiting.draftAction' : 'waiting.formAction')}
            </Link>,
          );
        })}
      </ul>
    </section>
  );
}
