import { useTranslation } from 'react-i18next';
import { daysUntil } from '@/lib/dates';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import type { DocumentsData } from '../api';
import { shownStep } from '../writing';

type Lane = 'ready' | 'team' | 'you';
const LANES: readonly Lane[] = ['ready', 'team', 'you'];
const COLOUR: Record<Lane, string> = {
  ready: 'bg-live',
  team: 'bg-hero-current',
  you: 'bg-hero-accent',
};

/** Every document and writing order, by who it waits on. */
function lanesOf(data: DocumentsData): Record<Lane, number> {
  const own = data.files.filter((file) => file.source === 'me');
  const steps = (data.writing ?? []).map(shownStep);
  return {
    ready:
      own.filter((file) => file.state === 'approved').length +
      steps.filter((step) => step === 'ready').length,
    team:
      own.filter((file) => file.state === 'review').length +
      steps.filter((step) => step === 'writing').length,
    you: data.required.length + steps.filter((step) => step === 'form' || step === 'review').length,
  };
}

/**
 * How ready the case is to apply: one segment per document and writing order, coloured by who it
 * waits on (ready, the team, the applicant), and the nearest upload deadline. Design: "Scorize New
 * User Dashboard v2" canvas, Documents.
 */
export function ReadyHero({ data }: { data: DocumentsData }) {
  const { t } = useTranslation('documents');
  const f = useFormat();
  const lanes = lanesOf(data);
  const total = lanes.ready + lanes.team + lanes.you;
  if (total === 0) return null;
  const segments = LANES.flatMap((lane) => Array.from({ length: lanes[lane] }, () => lane));
  const nearest = data.required
    .filter((item) => item.deadline)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0];

  return (
    <section
      aria-labelledby="docs-ready"
      className="flex flex-col gap-5 rounded-[24px] bg-hero px-5 py-[22px] text-on-hero shadow-hero lg:rounded-[32px] lg:px-9 lg:py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-hero-current">{t('ready.kicker')}</span>
          <h2
            id="docs-ready"
            className="m-0 font-display text-[22px] leading-snug font-bold lg:text-[26px]"
          >
            {t('ready.title', { percent: f.number(percentOf(lanes.ready, total)) })}
          </h2>
        </div>
        {nearest?.deadline && (
          <span className="flex flex-col gap-0.5 text-[13px] text-on-hero-2">
            {t('ready.nearest')}
            <span className="text-base font-bold text-hero-danger">
              {t('ready.nearestDoc', {
                name: nearest.name,
                days: f.number(daysUntil(nearest.deadline)),
              })}
            </span>
          </span>
        )}
      </div>
      <div
        aria-hidden="true"
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${String(total)}, minmax(0, 1fr))` }}
      >
        {segments.map((lane, index) => (
          <span key={index} className={`h-2.5 rounded-full ${COLOUR[lane]}`} />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[13px] text-on-hero-2">
        {LANES.map((lane) => (
          <li key={lane} className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-2.5 rounded-full ${COLOUR[lane]}`} />
            {t(`ready.lane.${lane}`, { n: f.number(lanes[lane]) })}
          </li>
        ))}
      </ul>
    </section>
  );
}
