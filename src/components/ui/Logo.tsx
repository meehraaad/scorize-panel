/**
 * The Scorize wordmark, same as the main site's header: SCORIZE in Arial Black, "RIZE" in the
 * primary colour. The font is the system Arial Black when installed, else the file the main site
 * already serves (`font-logo` in index.css).
 */
/** The brand name is never translated. */
const BRAND = ['Sco', 'rize'] as const;

export function Logo({
  className = '',
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'onHero';
}) {
  return (
    <span
      dir="ltr"
      className={`font-logo leading-none tracking-tight uppercase ${tone === 'onHero' ? 'text-on-hero' : 'text-text'} ${className}`}
    >
      {BRAND[0]}
      <span className={tone === 'onHero' ? 'text-hero-accent' : 'text-primary'}>{BRAND[1]}</span>
    </span>
  );
}
