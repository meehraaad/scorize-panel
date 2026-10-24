import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar, StepBar } from '@/components/ui/Progress';
import { SectionCard } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import type { ApplicantOverview } from '../api';

const STEP_TONE = { 1: 'text-urgent', 2: 'text-text-2', 3: 'text-good' } as const;
const WRITING_STEPS = [1, 2, 3] as const;

/** Side column of the home page: next instalment, documents, writing and the case team. */
export function CaseSummary({ data }: { data: ApplicantOverview }) {
  return (
    <>
      {data.installment && <Installment installment={data.installment} />}
      <Documents documents={data.documents} />
      {data.writing.length > 0 && <Writing writing={data.writing} />}
      {data.team.length > 0 && <Team team={data.team} />}
    </>
  );
}

function Installment({
  installment,
}: {
  installment: NonNullable<ApplicantOverview['installment']>;
}) {
  const { t } = useTranslation('home');
  const f = useFormat();
  return (
    <SectionCard
      variant="panel"
      id="home-installment"
      title={t('installment.title')}
      end={
        <Chip tone={installment.is_due ? 'warn' : 'neutral'} small>
          {t(installment.is_due ? 'installment.due' : 'installment.upcoming')}
        </Chip>
      }
    >
      <div className="flex flex-col gap-1">
        <span className="text-[28px] font-bold tabular-nums">
          {f.number(installment.amount)}{' '}
          <span className="text-[15px] font-medium text-text-2">{t('installment.toman')}</span>
        </span>
        <span className="text-sm leading-7 text-text-2">
          {[t('installment.label', { number: f.number(installment.number) }), installment.condition]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      {installment.payment_id !== null && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/payments/${String(installment.payment_id)}`}
            className={buttonClass('primary', 'flex-auto')}
          >
            {t('installment.payOnline')}
          </Link>
          <Link
            to={`/payments/${String(installment.payment_id)}?method=receipt`}
            className={buttonClass('outline', 'flex-auto')}
          >
            {t('installment.uploadReceipt')}
          </Link>
        </div>
      )}
      <Link to="/contract" className="text-sm font-medium text-primary-text">
        {t('installment.progress', {
          paid: f.number(installment.paid_count),
          count: f.number(installment.count),
        })}
      </Link>
    </SectionCard>
  );
}

function Documents({ documents }: { documents: ApplicantOverview['documents'] }) {
  const { t } = useTranslation('home');
  const f = useFormat();
  const waiting = Math.max(0, documents.required - documents.uploaded);
  return (
    <SectionCard
      variant="panel"
      id="home-documents"
      title={t('documents.title')}
      end={
        <span className="text-sm font-semibold">
          {t('documents.progress', {
            uploaded: f.number(documents.uploaded),
            required: f.number(documents.required),
          })}
        </span>
      }
    >
      <ProgressBar value={percentOf(documents.uploaded, documents.required)} />
      <span className="text-sm leading-7 text-text-2">
        {waiting === 0
          ? t('documents.complete')
          : [
              t('documents.waiting', { n: f.number(waiting) }),
              documents.next_due &&
                t('documents.nextDue', { date: f.dateShort(documents.next_due) }),
            ]
              .filter(Boolean)
              .join(' ')}
      </span>
      <Link to="/documents" className="text-sm font-medium text-primary-text">
        {t('documents.go')}
      </Link>
    </SectionCard>
  );
}

function Writing({ writing }: { writing: ApplicantOverview['writing'] }) {
  const { t } = useTranslation('home');
  const steps = WRITING_STEPS.map((step) => ({
    key: String(step),
    label: t(`writing.step.${step}`),
  }));
  return (
    <SectionCard variant="panel" id="home-writing" title={t('writing.title')}>
      {writing.map((item) => {
        const name = t(`writingType.${item.type}`);
        return (
          <div key={item.type} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold">{name}</span>
              <span className={`text-[13px] font-medium ${STEP_TONE[item.step]}`}>
                {t(`writing.status.${item.step}`)}
              </span>
            </div>
            <StepBar
              label={name}
              steps={steps}
              current={item.step - 1}
              finished={item.step === WRITING_STEPS.length}
            />
          </div>
        );
      })}
    </SectionCard>
  );
}

function Team({ team }: { team: ApplicantOverview['team'] }) {
  const { t } = useTranslation('home');
  return (
    <SectionCard variant="panel" id="home-team" title={t('team.title')}>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {team.map((member) => (
          <li key={`${member.role}-${member.name}`} className="flex items-center gap-3">
            <Avatar name={member.name} />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{member.name}</span>
              <span className="text-[13px] text-text-2">{t(`role.${member.role}`)}</span>
            </span>
          </li>
        ))}
      </ul>
      <Link to="/tickets" className={buttonClass('outline', 'mt-1')}>
        {t('team.send')}
      </Link>
      <span className="text-[13px] leading-7 text-text-2">{t('team.hours')}</span>
    </SectionCard>
  );
}
