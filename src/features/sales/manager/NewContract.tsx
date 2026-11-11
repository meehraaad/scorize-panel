import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/lib/toast';
import { useCreateTemplate, type ContractOverviewRow } from '../api';

/** The value of the "start from" choice for an empty contract. */
const EMPTY = 'empty';

/**
 * A new contract (S74): a name, a line for sellers, and where it starts: a copy of any contract
 * (its clauses, prices and rules) or empty. `onDone` gets the new contract's id, or nothing when
 * the manager cancels.
 */
export function NewContract({
  contracts,
  onDone,
}: {
  contracts: Pick<ContractOverviewRow, 'id' | 'name'>[];
  onDone: (id?: number) => void;
}) {
  const { t } = useTranslation('sales');
  const create = useCreateTemplate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // The standard contract is the first and the usual start.
  const [start, setStart] = useState(String(contracts[0]?.id ?? 'standard'));
  const key = (id: number | null) => String(id ?? 'standard');
  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        copy: start !== EMPTY,
        copy_from: start === EMPTY || start === 'standard' ? null : Number(start),
      },
      {
        onSuccess: ({ id }) => {
          toast.success(t('manager.contracts.added', { name: name.trim() }));
          onDone(id);
        },
        onError: () => toast.error(t('error')),
      },
    );
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        label={t('manager.builder.templates.name')}
        placeholder={t('manager.builder.templates.namePlaceholder')}
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label={t('manager.builder.templates.description')}
        hint={t('manager.builder.templates.descriptionHint')}
        value={description}
        maxLength={300}
        onChange={(event) => setDescription(event.target.value)}
      />
      <SelectField
        label={t('manager.builder.templates.start')}
        hint={t(start === EMPTY ? 'manager.builder.templates.emptyHint' : 'manager.builder.templates.copyHint')}
        value={start}
        onChange={setStart}
        options={[
          ...contracts.map((row) => ({
            value: key(row.id),
            label: t('manager.builder.templates.copy', { name: row.name }),
          })),
          { value: EMPTY, label: t('manager.builder.templates.empty') },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {t('manager.builder.templates.create')}
        </Button>
        <Button variant="outline" onClick={() => onDone()}>
          {t('manager.builder.cancel')}
        </Button>
      </div>
    </form>
  );
}
