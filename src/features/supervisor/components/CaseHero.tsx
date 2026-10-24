import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { initialOf } from '@/lib/text';
import type { CaseData } from '../api';
import { casePath } from '../paths';
import { StageChip } from './Chips';

const raised =
  'inline-flex h-11 items-center gap-2 rounded-full bg-hero-raised px-4 text-sm font-medium text-on-hero shadow-[inset_0_0_0_1px_var(--hero-line)] hover:bg-hero-line';

/** The dark card on top of a case file: who, which contract, the team, and the two main actions. */
export function CaseHero({ data, onStage }: { data: CaseData; onStage: () => void }) {
  const { t } = useTranslation('supervisor');
  const { t: tc } = useTranslation();
  const f = useFormat();
  const { contract } = data;

  const line = [
    t('fileNumber', { n: f.digits(String(data.file_number)) }),
    contract.kind,
    contract.degree === null ? '' : tc(`degree.${contract.degree}`),
    contract.countries.length ? f.list(contract.countries) : '',
  ].filter(Boolean);
  const team = [
    t('case.supervisors', { names: f.list(data.supervisors) }),
    data.consultant ? t('case.consultant', { name: data.consultant }) : '',
  ].filter(Boolean);

  return (
    <section
      aria-label={t('case.summary')}
      className="flex flex-col gap-6 rounded-card-sm bg-hero p-5 text-on-hero shadow-hero lg:rounded-[32px] lg:px-9 lg:py-8"
    >
      <div className="flex min-w-0 items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 flex-none items-center justify-center rounded-full bg-hero-raised text-xl font-bold"
        >
          {initialOf(data.name)}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 font-display text-2xl font-bold lg:text-[28px]">{data.name}</h1>
            <StageChip stage={data.stage} />
          </div>
          <span className="text-[15px] text-on-hero-2">{line.join(' · ')}</span>
          <span className="text-sm text-on-hero-2">{team.join(' · ')}</span>
          <span className="text-sm text-on-hero-2">
            <bdi>{f.digits(data.phone)}</bdi> · <bdi>{data.email}</bdi>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={casePath(data.id, 'tickets')}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-on-hero px-5 text-[15px] font-semibold text-hero"
        >
          <Icon name="chat" size={18} />
          {t('case.message')}
        </Link>
        <button type="button" onClick={onStage} className={raised}>
          <Icon name="pen" size={16} />
          {t('case.changeStage')}
        </button>
      </div>
    </section>
  );
}
