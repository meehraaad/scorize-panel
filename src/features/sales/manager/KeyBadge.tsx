/** A phone key as a round button face: "1", "*", "223". Decorative: the key is said in text too. */
export function KeyBadge({
  value,
  size = 'md',
  tone = 'primary',
}: {
  value: string;
  size?: 'sm' | 'md';
  tone?: 'primary' | 'danger' | 'muted';
}) {
  const tones = {
    primary: 'bg-tint text-primary-text',
    danger: 'bg-danger-tint text-danger',
    muted: 'bg-track text-text-2',
  };
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold tabular-nums ${tones[tone]} ${
        size === 'sm' ? 'h-8 min-w-8 px-1.5 text-sm' : 'h-12 min-w-12 px-2 text-lg'
      }`}
    >
      {value}
    </span>
  );
}
