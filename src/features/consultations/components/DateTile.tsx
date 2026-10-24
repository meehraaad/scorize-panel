import { useFormat } from '@/lib/i18n/useFormat';

/** A small calendar leaf: the day over the month (and the weekday when `large`). */
export function DateTile({
  value,
  highlight,
  large = false,
}: {
  value: string;
  highlight: boolean;
  large?: boolean;
}) {
  const f = useFormat();
  const { day, month } = f.dayMonth(value);
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none flex-col items-center justify-center rounded-2xl ${
        large ? 'size-24 gap-0.5 bg-hero-raised text-on-hero' : 'size-14'
      } ${!large && highlight ? 'bg-tint text-primary-text' : !large ? 'bg-canvas text-text' : ''}`}
    >
      {large && <span className="text-xs text-on-hero-2">{f.weekdayName(value)}</span>}
      <span className={`leading-none font-bold ${large ? 'text-[28px]' : 'text-lg'}`}>{day}</span>
      <span className={large ? 'text-[13px]' : 'text-xs'}>{month}</span>
    </span>
  );
}
