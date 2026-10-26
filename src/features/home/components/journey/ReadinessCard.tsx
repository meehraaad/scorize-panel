import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { ProgressRing, StepDot } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { SITE } from '@/lib/site';

export type ReadinessStep = 'estimate' | 'background' | 'files' | 'consult';

const NEXT = buttonClass('primary', 'max-sm:w-full');
const LATER = buttonClass('outline', 'max-sm:w-full');

/** Where each step's action goes: a panel page, a card on this page, or the site. */
const ACTION: Record<ReadinessStep, { to: string } | { href: string }> = {
  estimate: { to: '/estimate' },
  background: { to: '/background' },
  files: { href: '#review-upload' },
  consult: { href: SITE.consultation },
};

/**
 * How ready the person's case is for a contract: the steps that bring a seller's call closer
 * (quiz, tablet form, files for the free review, a consultation), done ones ticked, the first
 * open one highlighted with its action. Design: "Scorize New User Dashboard" canvas, readiness.
 */
export function ReadinessCard({ done }: { done: Record<ReadinessStep, boolean> }) {
  const { t } = useTranslation('journey');
  const f = useFormat();
  const steps = Object.keys(ACTION) as ReadinessStep[];
  const count = steps.filter((step) => done[step]).length;
  const percent = percentOf(count, steps.length);
  const next = steps.find((step) => !done[step]);

  return (
    <SectionCard
      id="journey-readiness"
      title={t('readiness.title')}
      subtitle={t('readiness.subtitle')}
      end={
        <span className="flex items-center gap-3">
          <ProgressRing
            value={percent}
            size={56}
            label={t('readiness.meter', { percent: f.number(percent) })}
          />
          <span aria-hidden="true" className="font-display text-xl font-bold">
            {t('readiness.percent', { percent: f.number(percent) })}
          </span>
        </span>
      }
    >
      <ol
        aria-label={t('readiness.steps')}
        className="m-0 flex list-none flex-col p-0 pb-2 lg:pb-3"
      >
        {steps.map((step, index) => {
          const current = step === next;
          const action = ACTION[step];
          const label = t(`readiness.step.${step}.action`);
          const look = current ? NEXT : LATER;
          return (
            <li
              key={step}
              aria-current={current ? 'step' : undefined}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 ${
                current ? 'bg-tint' : ''
              }`}
            >
              <StepDot
                number={f.number(index + 1)}
                state={done[step] ? 'done' : current ? 'current' : 'todo'}
              />
              <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  {t(`readiness.step.${step}.name`)}
                </span>
                <span className="text-[13px] leading-6 text-text-2">
                  {t(`readiness.step.${step}.hint`)}
                </span>
              </span>
              {done[step] ? (
                <Chip tone="good" small>
                  {t('readiness.done')}
                </Chip>
              ) : 'to' in action ? (
                <Link to={action.to} className={look}>
                  {label}
                </Link>
              ) : (
                <a href={action.href} className={look}>
                  {label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
