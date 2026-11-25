import { useFormat } from '@/lib/i18n/useFormat';

/** How many wait in a tab (nothing at zero). */
export function TabCount({ n, current }: { n: number; current: boolean }) {
  const f = useFormat();
  if (n <= 0) return null;
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums ${
        current
          ? 'bg-hero-accent text-hero dark:bg-primary dark:text-on-primary'
          : 'bg-primary text-on-primary'
      }`}
    >
      {f.number(n)}
    </span>
  );
}
