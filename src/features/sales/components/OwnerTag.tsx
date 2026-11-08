import { useSalesFormat } from '../format';

/**
 * Whose a lead or session is, on a sales manager's lists ("Seller: Sara"; "No seller" stands out).
 * Nothing for a seller, whose lists hold only their own.
 */
export function OwnerTag({
  seller,
  className = '',
}: {
  seller: string | null | undefined;
  className?: string;
}) {
  const s = useSalesFormat();
  const label = s.owner(seller);
  if (label === null) return null;
  return (
    <span
      className={`truncate text-xs font-medium ${seller ? 'text-text-2' : 'text-warn'} ${className}`}
    >
      {label}
    </span>
  );
}
