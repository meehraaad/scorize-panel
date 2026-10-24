/** Grey placeholder rows while a list loads (hidden from screen readers; the region is aria-busy). */
export function SkeletonRows({ rows }: { rows: number }) {
  return (
    <ul aria-hidden="true" className="m-0 list-none divide-y divide-hair p-0">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2 px-5 py-4 lg:px-8">
          <span className="h-4 w-1/3 animate-pulse rounded-full bg-track" />
          <span className="h-3 w-1/2 animate-pulse rounded-full bg-track" />
        </li>
      ))}
    </ul>
  );
}
