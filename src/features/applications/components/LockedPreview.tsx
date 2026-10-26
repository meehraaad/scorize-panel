import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import type { ApplicationResult } from '../api';
import { LANES, RESULT_TONE } from '../groups';

/** One example status per column; the rows themselves carry no names or numbers. */
const SHAPE: Record<(typeof LANES)[number], ApplicationResult> = {
  preparing: 'incomplete_documents',
  sent: 'submitted',
  decided: 'accepted',
};

/**
 * The page's layout for someone it isn't open to yet (faded under the lock banner): the parts and
 * their states, without sample universities, fees or dates.
 */
export function LockedPreview() {
  const { t } = useTranslation('applications');
  return (
    <>
      <div className="flex flex-col gap-4 rounded-[24px] bg-hero px-5 py-[22px] lg:rounded-[32px] lg:px-9 lg:py-8">
        <span className="text-[13px] font-bold text-hero-current">{t('quota.label')}</span>
        <span className="h-5 w-2/3 rounded-full bg-hero-raised" />
        <span className="flex gap-1">
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} className="h-2 flex-1 rounded-full bg-hero-line" />
          ))}
        </span>
      </div>
      <Card className="flex flex-col gap-3 p-5 shadow-[var(--panel-shadow),inset_0_0_0_1.5px_var(--hero-accent)]">
        <span className="self-start rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold text-primary-text">
          {t('awaiting.suggested')}
        </span>
        <span className="h-4 w-1/2 rounded-full bg-track" />
        <span className="h-3 w-1/3 rounded-full bg-track" />
        <span className="flex gap-2">
          <span className="h-11 flex-[2] rounded-full bg-tint" />
          <span className="h-11 flex-1 rounded-full shadow-[inset_0_0_0_1px_var(--line-2)]" />
        </span>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {LANES.map((lane) => (
          <Card key={lane} className="flex flex-col gap-3 p-5">
            <span className="font-bold">{t(`lanes.${lane}.title`)}</span>
            {Array.from({ length: 2 }, (_, index) => (
              <span
                key={index}
                className="flex flex-col gap-2 rounded-[18px] bg-canvas px-4 py-3.5"
              >
                <span className="h-3.5 w-3/5 rounded-full bg-track" />
                <span className="h-3 w-2/5 rounded-full bg-track" />
                <span className="self-start">
                  <Chip tone={RESULT_TONE[SHAPE[lane]]} small dot>
                    {t(`result.${SHAPE[lane]}`)}
                  </Chip>
                </span>
              </span>
            ))}
          </Card>
        ))}
      </div>
    </>
  );
}
