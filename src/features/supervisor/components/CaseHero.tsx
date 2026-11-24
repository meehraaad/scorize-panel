import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { CustomerFace } from '@/components/customers/CustomerFace';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { openCaseChat } from '@/lib/supervisor/caseChats';
import { caseKey, SUPERVISOR_API, type CaseData } from '../api';
import { StageChip } from './Chips';

const raised =
  'inline-flex h-11 items-center gap-2 rounded-full bg-hero-raised px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-line';

/**
 * The dark card on top of a case file: who, which contract, the team, and the two main actions.
 * The chat opens in a floating window that stays while the supervisor moves around the panel.
 */
export function CaseHero({
  data,
  onStage,
  appearance = 'supervisor',
  callLabel,
  children,
}: {
  data: CaseData;
  onStage?: () => void;
  appearance?: 'supervisor' | 'executive';
  children?: ReactNode;
  callLabel?: string;
}) {
  const executive = appearance === 'executive';
  const { t } = useTranslation('supervisor');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const { contract } = data;

  const line = [
    executive ? '' : t('fileNumber', { n: f.digits(String(data.file_number)) }),
    contract.kind,
    contract.degree === null ? '' : tc(`degree.${contract.degree}`),
    contract.countries.length ? f.list(contract.countries) : '',
    executive ? t('overview.contract.end') + ' ' + f.date(contract.ends_at) : '',
  ].filter(Boolean);
  const team = [
    t('case.supervisors', { names: f.list(data.supervisors) }),
    data.consultant ? t('case.consultant', { name: data.consultant }) : '',
  ].filter(Boolean);

  return (
    <section
      aria-label={t('case.summary')}
      className={`flex flex-col gap-6 rounded-card-sm p-5 lg:rounded-card lg:px-9 lg:py-8 ${executive ? 'text-text shadow-panel bg-aurora' : 'bg-hero text-on-hero shadow-hero'}`}
    >
      <div className="flex min-w-0 items-start gap-4">
        <CustomerFace
          round={!executive}
          name={data.name}
          face={data.face ?? null}
          url={`${SUPERVISOR_API}/cases/${String(data.id)}/face/`}
          queryKey={caseKey(data.id)}
          className="size-14 text-xl"
          plain={executive ? 'bg-primary text-on-primary' : 'bg-hero-raised text-on-hero'}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 font-display text-2xl font-bold lg:text-[28px]">{data.name}</h1>
            <StageChip stage={data.stage} />
            {executive && (
              <Chip tone="neutral">
                {t('fileNumber', { n: f.digits(String(data.file_number)) })}
              </Chip>
            )}
          </div>
          <span className={executive ? 'text-small text-text-2' : 'text-[15px] text-on-hero-2'}>
            {line.join(' · ')}
          </span>
          <span className={executive ? 'text-small text-text-2' : 'text-sm text-on-hero-2'}>
            {team.join(' · ')}
          </span>
          {!executive && (
            <span className="text-sm text-on-hero-2">
              <bdi>{f.digits(data.phone)}</bdi> · <bdi>{data.email}</bdi>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openCaseChat(data.id, data.name)}
          className={
            executive
              ? buttonClass('primary')
              : 'inline-flex h-11 items-center gap-2 rounded-full bg-on-hero px-5 text-[15px] font-semibold text-hero'
          }
        >
          <Icon name="chat" size={18} />
          {t('case.message')}
          {data.unread > 0 && (
            <>
              <Badge>{f.number(data.unread)}</Badge>
              <span className="sr-only">{t('case.tabs.unread')}</span>
            </>
          )}
        </button>
        {executive && callLabel && data.phone && (
          <a href={`tel:${data.phone.replace(/[^+0-9]/g, '')}`} className={buttonClass('outline')}>
            <Icon name="phone" size={18} />
            {callLabel}
          </a>
        )}
        {onStage && (
          <button
            type="button"
            onClick={onStage}
            className={executive ? buttonClass('outline') : raised}
          >
            <Icon name="pen" size={16} />
            {t('case.changeStage')}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
