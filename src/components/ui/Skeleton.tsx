import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Grey placeholder rows while a list loads (hidden from screen readers; the region is aria-busy). */
export function SkeletonRows({ rows }: { rows: number }) {
  return (
    <ul aria-hidden="true" className="m-0 list-none divide-y divide-hair p-0">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2 px-5 py-4 lg:px-8">
          <Bone className="h-4 w-1/3" />
          <Bone className="h-3 w-1/2" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The shape of a page while its code or data loads, one per page pattern. Each route names its
 * kind (`lazyPage(…, { skeleton })`); the panel draws it under the real header, so the user sees
 * the page's layout at once instead of a spinner (docs/performance.md, "Loading states").
 * `tab` is the body of a tab inside a page that keeps its own header (customer, case file).
 */
export type SkeletonKind =
  'dashboard' | 'list' | 'detail' | 'customer' | 'form' | 'board' | 'chat' | 'tab';

/**
 * Fades in after 150 ms, so a fast load shows nothing; once shown, React keeps a Suspense
 * fallback up for at least 300 ms, so it never blinks.
 */
export function PageSkeleton({ kind }: { kind: SkeletonKind }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('status.loading')}
      className="flex animate-appear flex-col gap-4 lg:gap-7"
    >
      {kind !== 'tab' && kind !== 'customer' && <HeaderBones />}
      {SHAPES[kind]}
    </div>
  );
}

/** One grey placeholder shape (a block whose content is on its way). */
export function Bone({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={`block animate-pulse rounded-full bg-track ${className}`} />
  );
}

function CardBones({ rows, className = '' }: { rows: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-card-sm bg-surface shadow-panel lg:rounded-card ${className}`}
    >
      <div className="px-5 pt-5 lg:px-8 lg:pt-7">
        <Bone className="h-5 w-40" />
      </div>
      <SkeletonRows rows={rows} />
    </div>
  );
}

function HeaderBones() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 lg:py-4">
      <Bone className="h-8 w-56 max-w-full lg:h-10 lg:w-80" />
      <Bone className="h-4 w-72 max-w-full" />
    </div>
  );
}

function Pills({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="flex gap-1.5 overflow-hidden">
      {Array.from({ length: count }, (_, index) => (
        <Bone key={index} className="h-10 w-24 flex-none" />
      ))}
    </div>
  );
}

/** A bone on the dark hero card. */
function HeroBone({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-full bg-hero-raised ${className}`} />;
}

function Tiles({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-card-sm bg-surface p-5 shadow-panel"
        >
          <Bone className="h-3 w-20" />
          <Bone className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

function Columns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4 lg:gap-7">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 lg:gap-7">{main}</div>
      <div className="flex min-w-0 flex-[1_1_350px] flex-col gap-4 lg:gap-7">{aside}</div>
    </div>
  );
}

function FieldBones({ count }: { count: number }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-6 rounded-card-sm bg-surface p-5 shadow-panel lg:rounded-card lg:p-8"
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2.5">
          <Bone className="h-3.5 w-32" />
          <span className="block h-12 animate-pulse rounded-xl bg-track" />
        </div>
      ))}
    </div>
  );
}

const SHAPES: Record<SkeletonKind, ReactNode> = {
  dashboard: (
    <>
      <Tiles count={4} />
      <Columns main={<CardBones rows={4} />} aside={<CardBones rows={3} />} />
    </>
  ),
  list: (
    <>
      <Pills count={4} />
      <CardBones rows={6} />
    </>
  ),
  detail: (
    <>
      <div
        aria-hidden="true"
        className="flex flex-col gap-4 rounded-card-sm bg-surface p-5 shadow-panel lg:rounded-card lg:p-8"
      >
        <Bone className="h-6 w-48" />
        <Bone className="h-4 w-64 max-w-full" />
        <div className="flex gap-2">
          <Bone className="h-11 w-28" />
          <Bone className="h-11 w-28" />
        </div>
      </div>
      <Pills count={4} />
      <Columns main={<CardBones rows={4} />} aside={<CardBones rows={2} />} />
    </>
  ),
  // The customer page (sales): back link, the dark summary card, its five tabs, then the summary
  // tab (tasks, history and aside), so nothing moves when it arrives.
  customer: (
    <>
      <Bone className="h-5 w-28" />
      <div
        aria-hidden="true"
        className="flex flex-col gap-6 rounded-card-sm bg-hero p-5 shadow-hero lg:rounded-[32px] lg:px-9 lg:py-8"
      >
        <div className="flex items-start gap-4">
          <HeroBone className="size-14 flex-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <HeroBone className="h-7 w-48 max-w-full" />
            <HeroBone className="h-4 w-72 max-w-full" />
            <HeroBone className="h-4 w-56 max-w-full" />
          </div>
        </div>
        <HeroBone className="h-2 w-full" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <HeroBone key={index} className="h-11 w-28" />
          ))}
        </div>
      </div>
      <Pills count={5} />
      <CardBones rows={2} />
      <Columns main={<CardBones rows={4} />} aside={<CardBones rows={2} />} />
    </>
  ),
  form: <Columns main={<FieldBones count={4} />} aside={<CardBones rows={2} />} />,
  board: (
    <div aria-hidden="true" className="flex gap-3 overflow-hidden lg:gap-5">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex w-64 flex-none flex-col gap-3 rounded-card-sm bg-surface p-4 shadow-panel"
        >
          <Bone className="h-4 w-24" />
          {Array.from({ length: 3 }, (_, card) => (
            <span key={card} className="block h-20 animate-pulse rounded-xl bg-track" />
          ))}
        </div>
      ))}
    </div>
  ),
  chat: (
    <>
      <Pills count={3} />
      <Columns
        main={<CardBones rows={5} className="min-h-[50vh]" />}
        aside={<CardBones rows={3} />}
      />
    </>
  ),
  tab: <Columns main={<CardBones rows={4} />} aside={<CardBones rows={2} />} />,
};
