import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { managerTeamQuery, useMoveCases } from '../api';

/**
 * Moves a person's cases to someone else on the team: the chosen `cases`, or without them all the
 * person's open cases (`count` of them). Their open services there go along.
 */
export function MoveDialog({
  person,
  cases,
  count,
  open,
  onClose,
  onMoved,
}: {
  person: { id: number; name: string };
  cases?: readonly number[];
  /** How many open cases the person has (when moving all of them). */
  count?: number;
  open: boolean;
  onClose: () => void;
  onMoved?: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const people = useQuery({ ...managerTeamQuery, enabled: open }).data?.people ?? [];
  const move = useMoveCases();
  const [to, setTo] = useState('');
  const [tried, setTried] = useState(false);
  const target = people.find((one) => String(one.id) === to);

  const submit = () => {
    setTried(true);
    if (!target) return;
    move.mutate(
      { person: person.id, to: target.id, ...(cases && { cases }) },
      {
        onSuccess: (result) => {
          toast.success(
            t('manager.move.done', {
              n: f.number(result.cases),
              name: target.name,
              services: f.number(result.services),
            }),
          );
          setTo('');
          setTried(false);
          onMoved?.();
          onClose();
        },
        onError: () => toast.error(t('saveError')),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('manager.move.title', { name: person.name })}
      subtitle={
        cases
          ? t('manager.move.chosen', { n: f.number(cases.length) })
          : t('manager.move.all', { n: f.number(count ?? 0) })
      }
      closeLabel={t('close')}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button disabled={move.isPending} onClick={submit}>
            {t('manager.move.confirm')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          label={t('manager.move.to')}
          value={to}
          onChange={setTo}
          options={[
            { value: '', label: t('manager.move.choose') },
            ...people
              .filter((one) => one.id !== person.id)
              .map((one) => ({
                value: String(one.id),
                label: t('manager.move.person', { name: one.name, n: f.number(one.cases) }),
              })),
          ]}
          error={tried && !target ? t('manager.move.toRequired') : undefined}
        />
        <p className="m-0 text-sm text-text-2">{t('manager.move.note')}</p>
      </div>
    </Dialog>
  );
}
