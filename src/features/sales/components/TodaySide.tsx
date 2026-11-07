import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ProgressBar } from '@/components/ui/Progress';
import { useFormat } from '@/lib/i18n/useFormat';
import { percentOf } from '@/lib/progress';
import type { MonthSummary, TodayData, Upsell } from '../api';
import { useSalesFormat } from '../format';
import { customerPath, salesPath } from '../paths';

const heading = 'm-0 flex-1 text-sm font-bold text-text-2';
const more = 'inline-flex min-h-11 items-center text-[13px] font-medium text-primary-text';

/**
 * The quiet column beside the day: the month, the chances to sell more and the team queue. Plain
 * text on the page, no cards, so it doesn't compete with the next step and the timetable.
 */
export function TodayAside({
  month,
  upsell,
  tasks,
}: {
  month: MonthSummary | undefined;
  upsell: Upsell[];
  tasks: TodayData['tasks'] | undefined;
}) {
  const { t } = useTranslation('sales');
  return (
    <aside aria-label={t('today.aside.label')} className="flex min-w-0 flex-col gap-7 lg:pt-2">
      {month && <MonthLine month={month} />}
      {upsell.length > 0 && <UpsellList items={upsell} />}
      {tasks && <TeamLine team={tasks.team} />}
    </aside>
  );
}

function MonthLine({ month }: { month: MonthSummary }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const s = useSalesFormat();
  const won = f.number(month.won);
  const target = f.number(month.target);
  return (
    <section aria-labelledby="today-month" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h2 id="today-month" className={heading}>
          {t('today.month.title')}
        </h2>
        <Link to={salesPath('month')} className={more}>
          {t('today.month.details')}
        </Link>
      </div>
      <span className="text-lg font-bold">
        {month.target > 0
          ? t('today.aside.won', { won, target })
          : t('today.aside.noTarget', { won })}
      </span>
      {month.target > 0 && (
        <ProgressBar
          value={percentOf(month.won, month.target)}
          label={t('today.aside.progress', { won, target })}
        />
      )}
      <span className="text-xs leading-6 text-text-2">
        {t('today.month.left', {
          days: f.number(month.working_days_left),
          drafts: f.number(month.drafts_waiting),
        })}
      </span>
      <span className="text-xs leading-6 text-text-2">
        {t('today.aside.figures', {
          conversion: s.percent(month.conversion),
          firstCall: s.minutes(month.first_call_minutes),
        })}
      </span>
    </section>
  );
}

type Item =
  | Exclude<Upsell, { kind: 'admitted' }>
  | { kind: 'admitted'; customer: number; name: string; universities: string[] };

/** Django sends one "admitted" row per admission: show each customer once, with all their offers. */
function mergeAdmissions(items: Upsell[]): Item[] {
  const merged: Item[] = [];
  const admitted = new Map<number, string[]>();
  for (const item of items) {
    if (item.kind !== 'admitted') {
      merged.push(item);
      continue;
    }
    const universities = admitted.get(item.customer);
    if (universities) {
      if (!universities.includes(item.university)) universities.push(item.university);
      continue;
    }
    const entry = { ...item, universities: [item.university] };
    admitted.set(item.customer, entry.universities);
    merged.push(entry);
  }
  return merged;
}

/** Customers ready for their next purchase: a line each, linking to the step that sells it. */
function UpsellList({ items }: { items: Upsell[] }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const merged = mergeAdmissions(items);
  const content = (item: Item) => {
    switch (item.kind) {
      case 'admitted':
        return {
          title: t('today.upsell.admitted.title', {
            name: item.name,
            university: f.list(item.universities),
          }),
          to: `${customerPath(item.customer)}/offer`,
        };
      case 'ending':
        return {
          title: t('today.upsell.ending.title', { name: item.name, days: f.number(item.days) }),
          to: `${customerPath(item.customer)}/offer`,
        };
      case 'no_contract':
        return {
          title: t('today.upsell.no_contract.title', { n: f.number(item.customers.length) }),
          to: salesPath('leads?stage=consulted'),
        };
    }
  };
  return (
    <section aria-labelledby="today-upsell" className="flex flex-col">
      <h2 id="today-upsell" className={`${heading} pb-2`}>
        {t('today.aside.upsell', { n: f.number(merged.length) })}
      </h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {merged.map((item, index) => {
          const { title, to } = content(item);
          return (
            <li key={index} className="shadow-[inset_0_1px_0_var(--hair)]">
              <Link
                to={to}
                className="flex min-h-11 flex-col justify-center gap-0.5 py-2.5 text-text hover:text-primary-text"
              >
                <span className="text-[13px] leading-6 font-semibold">{title}</span>
                <span className="text-xs text-primary-text">
                  {t(`today.upsell.${item.kind}.action`)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TeamLine({ team }: { team: number }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  return (
    <section aria-labelledby="today-team" className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h2 id="today-team" className={heading}>
          {t('today.aside.team')}
        </h2>
        <Link to={salesPath('tasks?view=team')} className={more}>
          {t('today.agenda.tasks')}
        </Link>
      </div>
      <span className="text-xs leading-6 text-text-2">
        {team > 0 ? t('today.aside.teamText', { n: f.number(team) }) : t('today.aside.teamEmpty')}
      </span>
    </section>
  );
}
