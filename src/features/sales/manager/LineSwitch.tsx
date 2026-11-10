import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChoiceGroup } from '@/components/ui/Choices';
import { useSaveOfficeHours, type LineForce, type OfficeHoursState } from '@/lib/sales/phoneCalls';
import { toast } from '@/lib/toast';

const FORCES = ['', 'open', 'closed'] as const satisfies readonly LineForce[];

/** Today's switch for the office line: open or closed until midnight, or back to the hours. Saves itself. */
export function LineSwitch({ data }: { data: OfficeHoursState }) {
  const { t } = useTranslation('sales');
  const save = useSaveOfficeHours();
  const [force, setForce] = useState<LineForce>(data.force);

  const change = (value: LineForce) => {
    const before = force;
    setForce(value);
    save.mutate(
      {
        week: data.week,
        direct: data.direct,
        closed_days: data.closed_days,
        force: value,
      },
      {
        onSuccess: () => toast.success(t(`manager.hours.today.saved.${value || 'auto'}`)),
        onError: () => {
          setForce(before);
          toast.error(t('error'));
        },
      },
    );
  };

  return (
    <ChoiceGroup
      legend={t('manager.hours.today.legend')}
      hideLegend
      look="segmented"
      options={FORCES.map((value) => ({
        value,
        label: t(`manager.hours.today.${value || 'auto'}`),
      }))}
      value={force}
      onChange={change}
    />
  );
}
