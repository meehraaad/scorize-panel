import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Chip } from '@/components/ui/Chip';
import { CustomerFace, FaceMark } from '@/components/customers/CustomerFace';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/SectionCard';
import { useFormat } from '@/lib/i18n/useFormat';
import { openCaseChat } from '@/lib/supervisor/caseChats';
import { caseKey, SUPERVISOR_API, type CaseData } from '../api';
import { StageChip } from './Chips';

const raised =
  'inline-flex h-11 items-center gap-2 rounded-full bg-hero-raised px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-line';

type CaseHeroProps = (
  | { data: CaseData; appearance?: 'supervisor' }
  | { data: CaseData | null; appearance: 'executive'; name: string }
) & {
  onStage?: () => void;
  children?: ReactNode;
  callLabel?: string;
};

/** The customer header, with case details and actions when a case is available. */
export function CaseHero(props: CaseHeroProps) {
  const { data, onStage, appearance, callLabel, children } = props;
  const executive = appearance === 'executive';
  const name =
    props.appearance === 'executive' ? (props.data?.name ?? props.name) : props.data.name;
  const { t } = useTranslation('supervisor');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const contract = data?.contract;

  const line =
    data && contract
      ? [
          executive ? '' : t('fileNumber', { n: f.digits(String(data.file_number)) }),
          contract.kind,
          contract.degree === null ? '' : tc(`degree.${contract.degree}`),
          contract.countries.length ? f.list(contract.countries) : '',
          executive ? t('overview.contract.end') + ' ' + f.date(contract.ends_at) : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '';
  const team = data
    ? [
        t('case.supervisors', { names: f.list(data.supervisors) }),
        data.consultant ? t('case.consultant', { name: data.consultant }) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <section
      aria-label={t('case.summary')}
      className={`flex flex-col gap-6 rounded-card-sm p-5 lg:rounded-card lg:px-9 lg:py-8 ${executive ? 'text-text shadow-panel bg-aurora' : 'bg-hero text-on-hero shadow-hero'}`}
    >
      <div className="flex min-w-0 items-start gap-4">
        {data ? (
          <CustomerFace
            round={!executive}
            name={name}
            face={data.face ?? null}
            url={`${SUPERVISOR_API}/cases/${String(data.id)}/face/`}
            queryKey={caseKey(data.id)}
            className="size-14 text-xl"
            plain={executive ? 'bg-primary text-on-primary' : 'bg-hero-raised text-on-hero'}
          />
        ) : (
          <FaceMark
            name={name}
            face={null}
            className="size-14 rounded-2xl text-xl"
            plain="bg-primary text-on-primary"
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 font-display text-2xl font-bold lg:text-[28px]">{name}</h1>
            {data && <StageChip stage={data.stage} />}
            {executive && data && (
              <Chip tone="neutral">
                {t('fileNumber', { n: f.digits(String(data.file_number)) })}
              </Chip>
            )}
          </div>
          {line && (
            <span className={executive ? 'text-small text-text-2' : 'text-[15px] text-on-hero-2'}>
              {line}
            </span>
          )}
          {team && (
            <span className={executive ? 'text-small text-text-2' : 'text-sm text-on-hero-2'}>
              {team}
            </span>
          )}
          {!executive && (
            <span className="text-sm text-on-hero-2">
              <bdi>{f.digits(data.phone)}</bdi> · <bdi>{data.email}</bdi>
            </span>
          )}
        </div>
      </div>

      {data && (
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
            <a
              href={`tel:${data.phone.replace(/[^+0-9]/g, '')}`}
              className={buttonClass('outline')}
            >
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
      )}
      {children}
    </section>
  );
}
