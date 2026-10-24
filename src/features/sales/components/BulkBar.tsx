import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import { useBulkLeads, type BulkChange } from '../api';
import { quickWhen, type QuickWhen } from '@/lib/when';

const STAGE_CHOICES = ['new', 'contacted', 'consulted', 'offer'] as const;
const WHEN_CHOICES = ['tomorrow', 'three', 'week'] as const satisfies readonly QuickWhen[];

type Action = 'stage' | 'followUp';

/** Over the list while leads are selected: move them to a stage, or set their next follow-up. */
export function BulkBar({ ids, onDone }: { ids: number[]; onDone: () => void }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const bulk = useBulkLeads();
  const [action, setAction] = useState<Action>('stage');
  const [stage, setStage] = useState<(typeof STAGE_CHOICES)[number]>('contacted');
  const [when, setWhen] = useState<(typeof WHEN_CHOICES)[number]>('tomorrow');

  const apply = () => {
    const change: BulkChange =
      action === 'stage' ? { stage } : { follow_up_at: quickWhen(when).toISOString() };
    bulk.mutate({ ids, change }, { onSuccess: onDone });
  };

  return (
    <div
      role="region"
      aria-label={t('leads.bulk.label')}
      className="flex flex-col gap-3 bg-tint px-5 py-3.5 text-text lg:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold" aria-live="polite">
          {t('leads.selected', { n: f.number(ids.length) })}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <SelectField
            inline
            label={t('leads.bulk.label')}
            value={action}
            onChange={setAction}
            options={[
              { value: 'stage', label: t('leads.bulk.stage') },
              { value: 'followUp', label: t('leads.bulk.followUp') },
            ]}
          />
          {action === 'stage' ? (
            <SelectField
              inline
              label={t('leads.bulk.stageTo')}
              value={stage}
              onChange={setStage}
              options={STAGE_CHOICES.map((value) => ({ value, label: t(`stage.${value}`) }))}
            />
          ) : (
            <SelectField
              inline
              label={t('leads.bulk.when')}
              value={when}
              onChange={setWhen}
              options={WHEN_CHOICES.map((value) => ({
                value,
                label: t(`customer.logDialog.followOption.${value}`),
              }))}
            />
          )}
          <Button className="h-11 px-4 text-sm" disabled={bulk.isPending} onClick={apply}>
            {t('leads.bulk.apply')}
          </Button>
          <Button variant="outline" className="h-11 px-4 text-sm" onClick={onDone}>
            {t('leads.bulk.clear')}
          </Button>
        </div>
      </div>
      {bulk.isError && <Notice tone="error">{t('error')}</Notice>}
    </div>
  );
}
