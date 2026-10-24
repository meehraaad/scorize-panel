import { useTranslation } from 'react-i18next';
import { ProgressBar, StepBar } from '@/components/ui/Progress';
import { daysBetween, daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import { STAGES, type ApplicantOverview } from '../api';

/** Dark case card: contract, destination, time left and the six case stages. */
export function CaseHero({ file }: { file: ApplicantOverview['file'] }) {
  const { t } = useTranslation('home');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const current = STAGES.indexOf(file.stage);
  const total = daysBetween(file.start_date, file.end_date);
  const left = Math.min(total, daysUntil(file.end_date));

  return (
    <section
      aria-label={t('hero.label')}
      className="flex flex-col gap-5 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:gap-8 lg:rounded-[32px] lg:px-11 lg:py-9"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-on-hero-2">
          <span>{t('hero.file', { id: f.number(file.applicant_id) })}</span>
          <span aria-hidden="true" className="size-1 rounded-full bg-on-hero-3" />
          <span>
            {t('hero.contract', {
              features: f.list(file.features.map((key) => t(`feature.${key}`))),
            })}
          </span>
        </div>
        <span className="inline-flex h-8 items-center gap-2 rounded-full bg-hero-raised px-3.5 text-sm font-medium">
          <span aria-hidden="true" className="size-2 rounded-full bg-hero-current" />
          {t(`stage.${file.stage}.status`)}
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <span className="font-display text-[26px] leading-tight font-bold lg:text-[40px]">
            {f.list(file.countries)}
          </span>
          <span className="text-[15px] text-on-hero-2">
            {t('hero.applies', {
              degrees: f.list(file.degrees.map((degree) => tc(`degree.${degree}`))),
              used: f.number(file.applies_used),
              total: f.number(file.applies_total),
            })}
          </span>
        </div>
        <div className="flex min-w-[220px] flex-[0_1_280px] flex-col gap-2">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-on-hero-2">{t('hero.timeLeft')}</span>
            <span className="font-semibold">
              {t('hero.days', { left: f.number(left), total: f.number(total) })}
            </span>
          </div>
          <ProgressBar value={percentOf(total - left, total)} size="sm" tone="onHero" />
        </div>
      </div>

      <StepBar
        label={t('hero.stages')}
        tone="onHero"
        steps={STAGES.map((stage) => ({ key: stage, label: t(`stage.${stage}.name`) }))}
        current={current}
        className="pt-5 shadow-[inset_0_1px_0_var(--hero-line)] lg:pt-7"
      />
    </section>
  );
}
