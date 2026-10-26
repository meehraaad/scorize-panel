import { useTranslation } from 'react-i18next';
import { LinkTile } from '@/components/ui/LinkTile';
import { StepBar } from '@/components/ui/Progress';
import { SectionHeading } from '@/components/ui/SectionCard';
import { SUPERVISOR_THREAD } from '@/lib/applicant/tickets';
import { STAGES } from '@/lib/applicant/stages';
import { useFormat } from '@/lib/i18n/useFormat';
import type { ApplicationsData } from '../api';

/**
 * A case with a contract but no application yet: where the case is, and what moves the first
 * application closer. Nothing here is a guess: the stage is the one the supervisor set.
 */
export function NoApplications({ data }: { data: ApplicationsData }) {
  const { t } = useTranslation('applications');
  const { t: th } = useTranslation('home');
  const f = useFormat();
  const { total } = data.applies;

  return (
    <>
      <section
        aria-labelledby="apps-stage"
        className="flex flex-col gap-5 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:gap-6 lg:rounded-[32px] lg:px-9 lg:py-8"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold text-hero-current">{t('empty.kicker')}</span>
          <h2
            id="apps-stage"
            className="m-0 font-display text-xl leading-snug font-bold lg:text-[26px]"
          >
            {t('empty.stage', { stage: th(`stage.${data.stage}.status`) })}
          </h2>
          <p className="m-0 text-sm leading-7 text-on-hero-2">
            {total > 0 ? t('empty.text', { total: f.number(total) }) : t('empty.textNoTotal')}{' '}
            {t('empty.stageText')}
          </p>
        </div>
        <StepBar
          label={t('empty.stages')}
          tone="onHero"
          steps={STAGES.map((stage) => ({ key: stage, label: th(`stage.${stage}.name`) }))}
          current={STAGES.indexOf(data.stage)}
        />
      </section>

      <section aria-labelledby="apps-now" className="flex flex-col gap-4">
        <SectionHeading id="apps-now" title={t('empty.now')} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <LinkTile
            to="/documents"
            title={t('empty.documents.title')}
            text={t('empty.documents.text')}
            footer={t('empty.documents.action')}
          />
          <LinkTile
            to="/documents"
            title={t('empty.interests.title')}
            text={t('empty.interests.text')}
            footer={t('empty.interests.action')}
          />
          <LinkTile
            to={`/tickets/${SUPERVISOR_THREAD}`}
            title={t('empty.supervisor.title')}
            text={t('empty.supervisor.text')}
            footer={t('empty.supervisor.action')}
          />
        </div>
      </section>
    </>
  );
}
