import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { transferSession, calculatorOptionsQuery } from './calculatorApi';

export function SessionTransfer({
  id,
  revision,
  ruleset,
  onTransferred,
  onBusy,
}: {
  id: string;
  revision: number;
  ruleset: string;
  onTransferred: (id: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation('assessments');
  const section = useId();
  const cache = useQueryClient();
  const [pending, setPending] = useState<{
    revision: number;
    ruleset_id: number;
    request_key: string;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: (body: { revision: number; ruleset_id: number; request_key: string }) =>
      transferSession(id, body),
    onSuccess: (result) => {
      void cache.invalidateQueries({ queryKey: calculatorOptionsQuery.queryKey });
      onBusy(false);
      onTransferred(result.id);
    },
  });
  return (
    <SectionCard id={section} title={t('transfer.title')} variant="panel">
      <div className="flex flex-col gap-3">
        <Notice tone="warn">{t('transfer.explanation')}</Notice>
        <p>{t('transfer.selectRules')}</p>
        <Button
          disabled={!ruleset || mutation.isPending}
          onClick={() => {
            const body = pending ?? {
              revision,
              ruleset_id: Number(ruleset),
              request_key: crypto.randomUUID(),
            };
            setPending(body);
            onBusy(true);
            mutation.mutate(body);
          }}
        >
          {t(pending ? 'transfer.retry' : 'transfer.start')}
        </Button>
        {mutation.error && <Notice tone="error">{t('transfer.failure')}</Notice>}
        {mutation.error && (
          <Button
            variant="outline"
            onClick={() => {
              setPending(null);
              onBusy(false);
              mutation.reset();
            }}
          >
            {t('transfer.discard')}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
