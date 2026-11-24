import { useTranslation } from 'react-i18next';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { PHONE_QUEUE_STRATEGIES, type PhoneTeamRouting } from '@/lib/sales/phoneCalls';

export function PhoneTeamRoutingFields({
  value,
  onChange,
}: {
  value: PhoneTeamRouting;
  onChange: (value: PhoneTeamRouting) => void;
}) {
  const { t } = useTranslation('sales');
  return (
    <fieldset className="m-0 flex flex-wrap items-end gap-4 border-0 p-0">
      <legend className="mb-2 text-sm font-semibold text-text-2">
        {t('manager.teams.routing.title')}
      </legend>
      <label className="flex min-w-48 flex-col gap-1 text-sm text-text-2">
        {t('manager.teams.routing.strategy')}
        <select
          className="min-h-11 rounded-xl border border-line-2 bg-surface px-3 text-body text-text"
          value={value.strategy}
          onChange={(event) => {
            const strategy = PHONE_QUEUE_STRATEGIES.find((option) => option === event.target.value);
            if (strategy) onChange({ ...value, strategy });
          }}
        >
          {PHONE_QUEUE_STRATEGIES.map((strategy) => (
            <option key={strategy} value={strategy}>
              {t(`manager.teams.routing.options.${strategy}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1 text-sm text-text-2">
        <span>{t('manager.teams.routing.timeout')}</span>
        <NumberStepper
          label={t('manager.teams.routing.timeout')}
          value={value.timeout}
          onChange={(timeout) => onChange({ ...value, timeout: Math.round(timeout) })}
          min={5}
          max={60}
          unit={t('manager.teams.routing.seconds')}
          decreaseLabel={t('manager.teams.routing.decrease')}
          increaseLabel={t('manager.teams.routing.increase')}
        />
      </div>
    </fieldset>
  );
}
