import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ApplicationStatus, ApplicationSummary } from '../api';
import { daysUntil } from '@/lib/dates';

/** A deadline this close is shown in the urgent colour. */
const URGENT_DAYS = 21;

const STATUS_TONE: Record<ApplicationStatus, ChipTone> = {
  awaiting_approval: 'primary',
  ready: 'warn',
  in_progress: 'neutral',
  submitted: 'neutral',
  accepted: 'good',
  rejected: 'danger',
};

export function DeadlinesCard({ deadlines }: { deadlines: ApplicationSummary[] }) {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation();
  const f = useFormat();

  return (
    <SectionCard
      id="home-deadlines"
      title={t('deadlines.title')}
      end={
        <Link
          to="/applications"
          className="flex-none text-sm font-medium whitespace-nowrap text-primary-text"
        >
          {t('deadlines.all')}
        </Link>
      }
    >
      {deadlines.length === 0 ? (
        <EmptyState>{t('deadlines.empty')}</EmptyState>
      ) : (
        <ul className="m-0 list-none divide-y divide-hair p-0">
          {deadlines.map((item) => {
            const days = item.deadline === null ? null : daysUntil(item.deadline);
            const status = t(`deadlines.status.${item.status}`);
            return (
              <li key={item.id}>
                <Link
                  to="/applications"
                  aria-label={
                    days === null
                      ? undefined
                      : t('deadlines.aria', {
                          university: item.university,
                          days: f.number(days),
                          status,
                        })
                  }
                  className="flex items-center gap-4 px-5 py-4 text-text hover:bg-canvas lg:gap-[18px] lg:px-8 lg:py-5"
                >
                  <span className="flex w-14 flex-none flex-col items-center gap-0.5 lg:w-16">
                    <span
                      className={`text-[26px] leading-none font-bold tabular-nums ${
                        days !== null && days <= URGENT_DAYS ? 'text-urgent' : 'text-text'
                      }`}
                    >
                      {days === null ? '–' : f.number(days)}
                    </span>
                    <span className="text-xs text-text-2">{t('deadlines.daysLeft')}</span>
                  </span>
                  <span className="flex min-w-0 flex-auto flex-col gap-1">
                    <bdi className="text-base font-semibold break-words">{item.university}</bdi>
                    <span className="text-sm text-text-2">
                      {[
                        tc(`degree.${item.degree}`),
                        item.program,
                        item.deadline && f.dateShort(item.deadline),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="flex flex-none flex-col items-end gap-1.5">
                    <Chip tone={STATUS_TONE[item.status]}>{status}</Chip>
                    {item.fee && (
                      <span className="hidden text-[13px] text-text-2 sm:inline">
                        {t(item.fee_paid ? 'deadlines.feePaid' : 'deadlines.feeUnpaid', {
                          fee: f.moneyName(item.fee.amount, item.fee.currency),
                        })}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
