import type { ReactNode } from 'react';

/*
 * The finder's pictures: thin line icons, flags and a level meter. They live in the finder's own
 * chunk, not in the shared Icon set, because only the finder draws them and Icon ships with every
 * page (docs/performance.md). Flags are artwork: their colours are the flags' own, not theme tokens.
 */

const PATHS = {
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18M11 12.5V14h2v-1.5" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5z" />
      <path d="M6.5 11.2v4.3c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.3M21.5 9v5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  seal: (
    <>
      <path d="M12 3l2.2 1.6 2.7-.1.8 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.8 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.8-2.6-2.2-1.6.9-2.6-.9-2.6 2.2-1.6.8-2.6 2.7.1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2.5" />
      <path d="M3 10h18M16 15h1.5M6 6l9-2.5a1.5 1.5 0 0 1 1.9 1.4V6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r=".8" />
    </>
  ),
  sparkle: (
    <path d="M11 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5zM18.5 15c.3 1.6 1 2.3 2.5 2.5-1.5.2-2.2.9-2.5 2.5-.3-1.6-1-2.3-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z" />
  ),
  forward: <path d="M5 12h14M13 6l6 6-6 6" />,
  rise: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  phone: (
    <path d="M5.2 4h3.3l1.6 4.4-2.1 1.4a11 11 0 0 0 6.2 6.2l1.4-2.1 4.4 1.6v3.3a1.6 1.6 0 0 1-1.7 1.6A16 16 0 0 1 3.6 5.7 1.6 1.6 0 0 1 5.2 4z" />
  ),
  restart: (
    <path d="M4.5 11a7.5 7.5 0 0 1 13-4.3L19.5 9M19.5 4.5V9H15M19.5 13a7.5 7.5 0 0 1-13 4.3L4.5 15M4.5 19.5V15H9" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1-3.8 4-5.5 7.5-5.5s6.5 1.7 7.5 5.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.8-3.3 3.3-5 6.5-5s5.7 1.7 6.5 5M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 15.2c2 .6 3.4 2.2 4 4.8" />
    </>
  ),
  chat: <path d="M4 5.5h16v10.5H9.5L4 20zM8.5 10.5h7" />,
  none: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.8 5.8 12.4 12.4" />
    </>
  ),
};

export type QuizIconName = keyof typeof PATHS;

/** A line icon, 24×24 in `currentColor`; decoration (the text beside it says it). */
export function QuizIcon({
  name,
  size = 24,
  className,
}: {
  name: QuizIconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ''}`}
    >
      {PATHS[name]}
    </svg>
  );
}

/* Flags on a 30×20 field. */
const bands = (colors: readonly string[], vertical: boolean) =>
  colors.map((fill, index) =>
    vertical ? (
      <rect key={fill + String(index)} x={index * 10} width="10.2" height="20" fill={fill} />
    ) : (
      <rect key={fill + String(index)} y={(index * 20) / 3} width="30" height="6.9" fill={fill} />
    ),
  );
const UNION = (
  <>
    <path d="M0 0l15 10M15 0 0 10" stroke="#fff" strokeWidth="2.2" />
    <path d="M0 0l15 10M15 0 0 10" stroke="#c8102e" strokeWidth=".8" />
    <path d="M7.5 0v10M0 5h15" stroke="#fff" strokeWidth="3" />
    <path d="M7.5 0v10M0 5h15" stroke="#c8102e" strokeWidth="1.6" />
  </>
);
const FLAGS: Record<string, ReactNode> = {
  DE: bands(['#1d1d1d', '#dd0000', '#ffce00'], false),
  AT: bands(['#c8102e', '#fff', '#c8102e'], false),
  HU: bands(['#ce2939', '#fff', '#477050'], false),
  NL: bands(['#ae1c28', '#fff', '#21468b'], false),
  IT: bands(['#009246', '#fff', '#ce2b37'], true),
  FR: bands(['#0055a4', '#fff', '#ef4135'], true),
  IE: bands(['#169b62', '#fff', '#ff883e'], true),
  BE: bands(['#1d1d1d', '#fdda24', '#ef3340'], true),
  CA: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <rect width="7.5" height="20" fill="#d80621" />
      <rect x="22.5" width="7.5" height="20" fill="#d80621" />
      <path
        fill="#d80621"
        d="M15 3.8l1.1 2.1 1.5-.7-.5 3.4 1.9-1.9.5 1.2 1.8-.3-.6 2 .9.5-3.4 2.4.4 1.2-2.9-.4.1 2.9h-1.4l.1-2.9-2.9.4.4-1.2-3.4-2.4.9-.5-.6-2 1.8.3.5-1.2 1.9 1.9-.5-3.4 1.5.7z"
      />
    </>
  ),
  AU: (
    <>
      <rect width="30" height="20" fill="#012169" />
      {UNION}
      <g fill="#fff">
        <circle cx="7.5" cy="15.2" r="1.5" />
        <circle cx="22.5" cy="4.5" r=".9" />
        <circle cx="26" cy="8.6" r=".9" />
        <circle cx="19.5" cy="9.6" r=".9" />
        <circle cx="22.5" cy="16" r="1" />
      </g>
    </>
  ),
  NZ: (
    <>
      <rect width="30" height="20" fill="#012169" />
      {UNION}
      <g fill="#c8102e" stroke="#fff" strokeWidth=".4">
        <circle cx="22.5" cy="4.5" r="1" />
        <circle cx="26" cy="8.6" r="1" />
        <circle cx="19.5" cy="9.6" r="1" />
        <circle cx="22.5" cy="16" r="1.1" />
      </g>
    </>
  ),
  GB: (
    <>
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0l30 20M30 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l30 20M30 0 0 20" stroke="#c8102e" strokeWidth="1.4" />
      <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
      <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.4" />
    </>
  ),
  US: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((stripe) => (
        <rect key={stripe} y={(stripe * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="12" height="10.8" fill="#3c3b6e" />
    </>
  ),
  TR: (
    <>
      <rect width="30" height="20" fill="#e30a17" />
      <circle cx="11" cy="10" r="5" fill="#fff" />
      <circle cx="12.3" cy="10" r="4" fill="#e30a17" />
      <polygon
        fill="#fff"
        points="14.40,10.00 15.87,9.47 15.92,7.91 16.88,9.14 18.38,8.71 17.50,10.00 18.38,11.29 16.88,10.86 15.92,12.09 15.87,10.53"
      />
    </>
  ),
  SE: (
    <>
      <rect width="30" height="20" fill="#006aa7" />
      <path d="M11 0v20M0 10h30" stroke="#fecc02" strokeWidth="3.4" />
    </>
  ),
  CH: (
    <>
      <rect width="30" height="20" fill="#da291c" />
      <path d="M15 5v10M10 10h10" stroke="#fff" strokeWidth="3.4" />
    </>
  ),
};

/**
 * A country's flag, filling its box (cropped to it). A country we have no flag for: its first
 * letter on the tint.
 */
export function Flag({ code, name }: { code?: string | undefined; name: string }) {
  const art = code ? FLAGS[code.toUpperCase()] : undefined;
  if (!art)
    return (
      <span
        aria-hidden="true"
        className="flex size-full items-center justify-center bg-tint font-bold text-primary-text"
      >
        {name.slice(0, 1)}
      </span>
    );
  return (
    <svg
      viewBox="0 0 30 20"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="block size-full"
    >
      {art}
    </svg>
  );
}

/** A small flag beside a country's name. */
export function SmallFlag({ code, name }: { code?: string | undefined; name: string }) {
  return (
    <span className="inline-flex h-4 w-6 flex-none overflow-hidden rounded border border-hair">
      <Flag code={code} name={name} />
    </span>
  );
}

/** A level meter: `of` bars rising left to right, the first `level + 1` filled. */
export function LevelBars({ level, of }: { level: number; of: number }) {
  return (
    <span dir="ltr" aria-hidden="true" className="flex h-5 items-end gap-[3px]">
      {Array.from({ length: of }, (_, index) => (
        <span
          key={index}
          className={`rounded-full ${index <= level ? 'bg-current' : 'bg-line-2'}`}
          style={{ width: 4, height: 6 + (index * 14) / Math.max(1, of - 1) }}
        />
      ))}
    </span>
  );
}
