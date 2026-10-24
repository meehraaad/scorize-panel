const TONES = {
  default: 'text-text',
  primary: 'text-primary-text',
  good: 'text-good',
  urgent: 'text-urgent',
} as const;

export interface Stat {
  label: string;
  /** Already formatted for the locale. */
  value: string;
  /** Small text after the number ("of 15", "applications"). */
  unit?: string;
  /** A line under the number ("oldest: 33 minutes", "team goal: 15"). */
  note?: string;
  tone?: keyof typeof TONES;
}

/** A row of numbers in tiles (2 columns on phones, 4 on wide screens). */
export function StatGrid({ label, stats }: { label: string; stats: readonly Stat[] }) {
  return (
    <section aria-label={label}>
      <dl className="m-0 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-2 rounded-card-sm bg-surface p-4 shadow-panel lg:rounded-card lg:px-6 lg:py-[22px]"
          >
            <dt className="text-sm text-text-2">{stat.label}</dt>
            <dd className="m-0 flex items-baseline gap-1.5">
              <span
                className={`text-[26px] leading-none font-bold tabular-nums lg:text-[32px] ${TONES[stat.tone ?? 'default']}`}
              >
                {stat.value}
              </span>
              {stat.unit && <span className="text-sm text-text-2">{stat.unit}</span>}
            </dd>
            {stat.note && <dd className="m-0 text-[13px] text-text-2">{stat.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
