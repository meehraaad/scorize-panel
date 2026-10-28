import type { CSSProperties } from 'react';
import styles from './RouteLine.module.css';

export type StopState = 'done' | 'now' | 'warn' | 'next';

export interface Stop {
  key: string;
  label: string;
  /** A short line under the label ("2 of 4", "by SMS"). */
  hint?: string;
  state: StopState;
}

/**
 * The stops on the way to a case, on a forest or luxe card: how long the way is tells the two
 * contracts apart (Turkey online in three stops, the full contract through the office in four).
 * The current stop is `aria-current`. Design: canvas "قرارداد و پرداخت: بدون قرارداد".
 */
export function RouteLine({
  label,
  stops,
  ground,
  className = '',
}: {
  label: string;
  stops: Stop[];
  /** The card it sits on: the empty dots take its colour, so the line doesn't show through. */
  ground: 'forest' | 'luxe';
  className?: string;
}) {
  return (
    <ol
      aria-label={label}
      className={`${styles.route} ${styles[ground]} ${className}`}
      style={{ '--stops': stops.length } as CSSProperties}
    >
      {stops.map((stop) => (
        <li
          key={stop.key}
          aria-current={stop.state === 'now' || stop.state === 'warn' ? 'step' : undefined}
          className={styles.stop}
        >
          <span
            aria-hidden="true"
            className={`${styles.dot} ${stop.state === 'next' ? '' : styles[stop.state]}`}
          />
          <span className="text-xs font-bold lg:text-sm">{stop.label}</span>
          {stop.hint && (
            <span
              className={`text-[11px] font-semibold lg:text-xs ${
                stop.state === 'now'
                  ? 'text-luxe-gold-light'
                  : stop.state === 'warn'
                    ? 'text-hero-current'
                    : 'text-on-hero-2'
              }`}
            >
              {stop.hint}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
