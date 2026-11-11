import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/Chip';
import { useFormat } from '@/lib/i18n/useFormat';

/** A staff member's name, or "device number 77" with an "unmapped" chip while nobody is mapped to it. */
export function PersonName({
  name,
  employeeId,
  enrollId,
}: {
  name: string;
  employeeId: number | null;
  enrollId: number | null;
}) {
  const { t } = useTranslation('attendance');
  const f = useFormat();
  if (employeeId) return <span className="font-semibold">{name}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-semibold">
        {name || t('person.number', { n: f.number(enrollId ?? 0) })}
      </span>
      <Chip tone="warn" small>
        {t('person.unmapped')}
      </Chip>
    </span>
  );
}
