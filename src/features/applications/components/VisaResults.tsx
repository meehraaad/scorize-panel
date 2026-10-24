import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { StepBar } from '@/components/ui/Progress';
import { SectionHeading } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { safeHref } from '@/lib/url';
import type { VisaResult, VisaStatus } from '../api';

const STEPS = [0, 1, 2, 3] as const;

/** Which of the four steps a status is at. */
const STEP_OF: Record<VisaStatus, (typeof STEPS)[number]> = {
  getting_appointment: 0,
  pending_appointment: 1,
  missed_appointment: 1,
  canceled_appointment: 1,
  pending_result: 2,
  granted: 3,
  refused: 3,
};

const TONE: Record<VisaStatus, ChipTone> = {
  getting_appointment: 'warn',
  pending_appointment: 'warn',
  pending_result: 'info',
  granted: 'good',
  refused: 'danger',
  missed_appointment: 'danger',
  canceled_appointment: 'neutral',
};

/** Visa cases of the contract (shown only when it includes visa services). */
export function VisaResults({ results }: { results: VisaResult[] }) {
  const { t } = useTranslation('applications');
  if (results.length === 0) return null;
  return (
    <section aria-labelledby="apps-visa" className="flex flex-col gap-4">
      <SectionHeading id="apps-visa" title={t('visa.title')} />
      {results.map((visa) => (
        <VisaCard key={visa.id} visa={visa} />
      ))}
    </section>
  );
}

function VisaCard({ visa }: { visa: VisaResult }) {
  const { t } = useTranslation('applications');
  const f = useFormat();
  const current = STEP_OF[visa.status];
  const finished = visa.status === 'granted';

  return (
    <Card className="flex flex-col gap-[22px] p-5 lg:px-8 lg:py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-[17px] font-bold">{visa.title}</h3>
          <span className="text-sm text-text-2">
            {t('visa.place', { destination: visa.destination, embassy: visa.embassy })}
          </span>
        </div>
        <Chip tone={TONE[visa.status]} dot>
          {t(`visa.status.${visa.status}`)}
        </Chip>
      </div>

      <StepBar
        label={t('visa.steps')}
        steps={STEPS.map((step) => ({ key: String(step), label: t(`visa.step.${step}`) }))}
        current={current}
        finished={finished}
      />

      <dl className="m-0 grid grid-cols-1 gap-[18px] sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <dt className="text-[13px] text-text-2">{t('visa.appointment')}</dt>
          <dd
            className={`m-0 text-[15px] font-semibold ${visa.appointment_at ? '' : 'text-text-2'}`}
          >
            {visa.appointment_at ? f.dateTime(visa.appointment_at) : t('visa.unknown')}
          </dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="text-[13px] text-text-2">{t('visa.resolved')}</dt>
          <dd className={`m-0 text-[15px] font-semibold ${visa.resolved_at ? '' : 'text-text-2'}`}>
            {visa.resolved_at ? f.date(visa.resolved_at) : t('visa.unknown')}
          </dd>
        </div>
        {visa.appointment_proof && (
          <div className="flex flex-col gap-1.5">
            <dt className="text-[13px] text-text-2">{t('visa.proof')}</dt>
            <dd className="m-0">
              <a
                href={safeHref(visa.appointment_proof)}
                download
                className="-my-2.5 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-primary-text"
              >
                <Icon name="download" size={18} />
                {t('visa.download')}
              </a>
            </dd>
          </div>
        )}
      </dl>

      {visa.note && (
        <p className="m-0 rounded-2xl bg-canvas px-[18px] py-3.5 text-sm leading-7">
          <span className="font-semibold">{t('noteLabel')}</span> {visa.note}
        </p>
      )}
    </Card>
  );
}
