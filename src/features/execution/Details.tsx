import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { CASE_PATH } from '@/lib/execution/paths';
import { useFormat } from '@/lib/i18n/useFormat';
import { caseFile, people, type Person, type Phase, type ProgramDetails } from './data';

export function CaseLink() {
  return (
    <Link
      to={CASE_PATH}
      className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline"
    >
      {caseFile.name}
    </Link>
  );
}

export function Details({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3">
      {rows.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-text-2">{label}</dt>
          <dd className="m-0 mt-1 text-sm leading-6 font-semibold [overflow-wrap:anywhere]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DateText({ date }: { date: string }) {
  const f = useFormat();
  return <time dateTime={date}>{f.date(new Date(`${date}T12:00:00`))}</time>;
}

export function Responsibility({ owner, actor }: { owner: Person; actor: Person | null }) {
  const { t } = useTranslation('execution');
  return (
    <Details
      rows={[
        { label: t('owner'), value: people[owner] },
        { label: t('nextActor'), value: actor ? people[actor] : t('none') },
      ]}
    />
  );
}

const phaseTone: Record<Phase, ChipTone> = {
  searching: 'info',
  review: 'primary',
  sent: 'warn',
  approved: 'good',
  added: 'good',
};

export function PhaseChip({ phase }: { phase: Phase }) {
  const { t } = useTranslation('execution');
  return (
    <Chip tone={phaseTone[phase]} dot>
      {t(`phases.${phase}`)}
    </Chip>
  );
}

export function ProgramText({ option }: { option: ProgramDetails }) {
  return (
    <span className="flex min-w-0 items-start gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 flex-none items-center justify-center rounded-xl bg-tint text-primary-text"
      >
        <Icon name="graduation" size={19} />
      </span>
      <span className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
        <bdi className="text-base leading-6 font-bold">{option.university}</bdi>
        <bdi className="text-sm leading-6 text-text-2">{option.program}</bdi>
      </span>
    </span>
  );
}
