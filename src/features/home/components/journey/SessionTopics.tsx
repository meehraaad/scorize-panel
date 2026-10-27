import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';

const TOPICS = ['countries', 'costs', 'timeline', 'turkey'] as const;

/**
 * Before a booked session: what it will cover (country, costs and instalments, timeline, Turkey
 * without paying first), so they come ready to decide, and the contract offer it leads to, locked
 * until the session is over. Desktop only: phones keep the session card short.
 * Design: "Scorize New User Dashboard v2" canvas, UpcomingConsult.
 */
export function SessionTopics() {
  const { t } = useTranslation('journey');
  return (
    <div className="grid gap-4 max-lg:hidden lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card aria-labelledby="journey-topics" className="flex flex-col gap-4 p-5 lg:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="journey-topics" className="m-0 text-lg font-bold">
            {t('topics.title')}
          </h2>
          <p className="m-0 text-[13px] leading-6 text-text-2">{t('topics.subtitle')}</p>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
          {TOPICS.map((topic) => (
            <li key={topic} className="flex flex-col gap-0.5 rounded-2xl bg-canvas px-4 py-3">
              <span className="text-sm font-semibold">{t(`topics.${topic}.name`)}</span>
              <span className="text-[13px] text-text-2">{t(`topics.${topic}.hint`)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card
        aria-labelledby="journey-offer"
        className="flex flex-col gap-3 p-5 shadow-[inset_0_0_0_1.5px_var(--line-2)] lg:p-6"
      >
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-xl bg-canvas text-text-2"
        >
          <Icon name="lock" size={18} />
        </span>
        <h2 id="journey-offer" className="m-0 text-base font-bold">
          {t('topics.offer.title')}
        </h2>
        <p className="m-0 text-[13px] leading-6 text-text-2">{t('topics.offer.text')}</p>
        <span className="mt-auto text-[13px] font-semibold text-text-2">
          {t('topics.offer.locked')}
        </span>
      </Card>
    </div>
  );
}
