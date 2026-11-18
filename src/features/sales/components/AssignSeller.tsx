import { useTranslation } from 'react-i18next';
import { SelectField } from '@/components/ui/Choices';
import { useDisplayName } from '@/lib/i18n/useDisplayName';
import { toast } from '@/lib/toast';
import { useAssignConsultation } from '../api';

/** What the menu needs of a consultation: its customer's name and who holds it now. */
export interface Assignable {
  id: number;
  name: string;
  seller?: string | null | undefined;
  seller_id?: number | null | undefined;
}

/**
 * A sales manager gives a paid consultation to a seller, or takes it back (nobody): on the
 * calendar's card and on each row of the manager's consultations list. One nobody holds stands out.
 */
export function AssignSeller({
  item,
  sellers,
  hideLabel = false,
}: {
  item: Assignable;
  sellers: readonly { id: number; name: string }[];
  hideLabel?: boolean;
}) {
  const { t } = useTranslation('sales');
  const named = useDisplayName();
  const assign = useAssignConsultation();
  const current = item.seller_id ?? null;
  // Someone who left the team still shows as the holder until it is given to another.
  const options = [
    { value: 'none', label: t('consultationCalendar.noSeller') },
    ...(current !== null && !sellers.some((seller) => seller.id === current)
      ? [{ value: String(current), label: item.seller ?? '' }]
      : []),
    ...sellers.map((seller) => ({ value: String(seller.id), label: seller.name })),
  ];
  return (
    <div className={current === null ? 'rounded-full bg-warn-tint p-1' : ''}>
      <SelectField
        inline
        hideLabel={hideLabel}
        label={
          hideLabel
            ? t('consultationCalendar.assign.labelFor', { name: named(item.name) })
            : t('consultationCalendar.assign.label')
        }
        value={current === null ? 'none' : String(current)}
        options={options}
        onChange={(value) => {
          const staff = value === 'none' ? null : Number(value);
          assign.mutate(
            { id: item.id, staff },
            {
              onSuccess: (result) =>
                toast.success(
                  result.seller
                    ? t('consultationCalendar.assign.done', {
                        name: named(item.name),
                        seller: result.seller,
                      })
                    : t('consultationCalendar.assign.cleared', { name: named(item.name) }),
                ),
              onError: () => toast.error(t('consultationCalendar.assign.failed')),
            },
          );
        }}
      />
    </div>
  );
}
