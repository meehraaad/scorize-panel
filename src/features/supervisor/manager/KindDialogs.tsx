import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import {
  useCreateKind,
  useSaveStages,
  useUpdateKind,
  type ServiceKind,
  type ServiceKindsData,
  type StageBody,
} from '../api';

const NO_TEAM = 'none';
const EVERY_COUNTRY = 'all';

/** A new simple service (no `kind`), or one service's name, team, country rule and activity. */
export function KindDialog({
  kind,
  data,
  open,
  onClose,
}: {
  kind?: ServiceKind;
  data: ServiceKindsData;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const create = useCreateKind();
  const update = useUpdateKind();
  const [name, setName] = useState(kind?.name ?? '');
  const [team, setTeam] = useState(kind?.team ?? NO_TEAM);
  const [perCountry, setPerCountry] = useState(kind?.needs_country ?? true);
  const [active, setActive] = useState(kind?.is_active ?? true);
  const [tried, setTried] = useState(false);
  // Code reads a built-in service per country or not; one with services keeps its rule.
  const fixedRule = kind !== undefined && (kind.built_in || kind.services > 0);
  const pending = create.isPending || update.isPending;

  const submit = () => {
    setTried(true);
    if (!name.trim()) return;
    const body = {
      name: name.trim(),
      team: team === NO_TEAM ? null : team,
      needs_country: perCountry,
      is_active: active,
    };
    const done = {
      onSuccess: () => {
        toast.success(t(kind ? 'manager.kinds.saved' : 'manager.kinds.made', { name: body.name }));
        if (!kind) {
          setName('');
          setTried(false);
        }
        onClose();
      },
      onError: () => toast.error(t('saveError')),
    };
    if (kind) update.mutate({ id: kind.id, ...body }, done);
    else create.mutate(body, done);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind ? t('manager.kinds.editTitle', { name: kind.name }) : t('manager.kinds.new')}
      subtitle={kind ? undefined : t('manager.kinds.newText')}
      closeLabel={t('close')}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={submit}>
            {t(kind ? 'manager.kinds.save' : 'manager.kinds.make')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label={t('manager.kinds.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={tried && !name.trim() ? t('manager.kinds.nameRequired') : undefined}
        />
        <SelectField
          label={t('manager.kinds.team')}
          value={team}
          onChange={setTeam}
          options={[
            { value: NO_TEAM, label: t('manager.kinds.noTeam') },
            ...data.teams.map((one) => ({ value: one.key, label: one.name })),
          ]}
        />
        <Switch
          label={t('manager.kinds.perCountryLabel')}
          description={
            fixedRule ? t('manager.kinds.perCountryFixed') : t('manager.kinds.perCountryHint')
          }
          checked={perCountry}
          disabled={fixedRule}
          onChange={setPerCountry}
        />
        <Switch
          label={t('manager.kinds.activeLabel')}
          description={t('manager.kinds.activeHint')}
          checked={active}
          onChange={setActive}
        />
      </div>
    </Dialog>
  );
}

interface Row extends StageBody {
  /** A stable key for the list while rows move. */
  row: string;
  removable: boolean;
}

/** A service's stages in order: rename, reorder, add, remove, one country's only, final. */
export function StagesDialog({
  kind,
  data,
  open,
  onClose,
}: {
  kind: ServiceKind;
  data: ServiceKindsData;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('supervisor');
  const f = useFormat();
  const save = useSaveStages();
  const fromKind = (): Row[] =>
    kind.stages.map((stage) => ({
      row: `s${String(stage.id)}`,
      id: stage.id,
      name: stage.name,
      country: stage.country?.id ?? null,
      final: stage.final,
      removable: stage.removable,
    }));
  const [rows, setRows] = useState<Row[]>(fromKind);
  const [added, setAdded] = useState(0);
  const [tried, setTried] = useState(false);

  const change = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const swap = (index: number, other: number) =>
    setRows((current) => {
      const next = [...current];
      const [a, b] = [next[index], next[other]];
      if (!a || !b) return current;
      next[index] = b;
      next[other] = a;
      return next;
    });

  const close = () => {
    setRows(fromKind());
    setTried(false);
    onClose();
  };

  const submit = () => {
    setTried(true);
    if (rows.some((row) => !row.name.trim())) return;
    save.mutate(
      {
        id: kind.id,
        stages: rows.map(({ id, name, country, final }) => ({
          ...(id !== undefined && { id }),
          name: name.trim(),
          country,
          final,
        })),
      },
      {
        onSuccess: () => {
          toast.success(t('manager.kinds.stages.saved', { name: kind.name }));
          setTried(false);
          onClose();
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t('manager.kinds.stages.conflict')
              : t('saveError'),
          ),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('manager.kinds.stages.title', { name: kind.name })}
      subtitle={t('manager.kinds.stages.text')}
      closeLabel={t('close')}
      size="wide"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button disabled={save.isPending} onClick={submit}>
            {t('manager.kinds.stages.save')}
          </Button>
          <Button variant="outline" onClick={close}>
            {t('cancel')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row, index) => {
            const label = t('manager.kinds.stages.row', { n: f.number(index + 1) });
            return (
              <li
                key={row.row}
                aria-label={label}
                className="flex flex-col gap-3 rounded-card-sm bg-canvas p-3 lg:flex-row lg:items-end"
              >
                <div className="grow">
                  <TextField
                    label={label}
                    value={row.name}
                    onChange={(event) => change(index, { name: event.target.value })}
                    error={tried && !row.name.trim() ? t('manager.kinds.nameRequired') : undefined}
                  />
                </div>
                {kind.needs_country && (
                  <SelectField
                    label={t('manager.kinds.stages.country')}
                    value={row.country === null ? EVERY_COUNTRY : String(row.country)}
                    onChange={(value) =>
                      change(index, { country: value === EVERY_COUNTRY ? null : Number(value) })
                    }
                    disabled={!row.removable && row.id !== undefined}
                    options={[
                      { value: EVERY_COUNTRY, label: t('manager.kinds.stages.everyCountry') },
                      ...data.countries.map((country) => ({
                        value: String(country.id),
                        label: country.name,
                      })),
                    ]}
                  />
                )}
                <div className="flex items-center gap-1">
                  <Switch
                    label={t('manager.kinds.stages.final')}
                    checked={row.final}
                    onChange={(final) => change(index, { final })}
                  />
                  <IconButton
                    icon="chevronDown"
                    className="rotate-180"
                    aria-label={t('manager.kinds.stages.up', { name: row.name || label })}
                    disabled={index === 0}
                    onClick={() => swap(index, index - 1)}
                  />
                  <IconButton
                    icon="chevronDown"
                    aria-label={t('manager.kinds.stages.down', { name: row.name || label })}
                    disabled={index === rows.length - 1}
                    onClick={() => swap(index, index + 1)}
                  />
                  <IconButton
                    icon="trash"
                    tone="danger"
                    aria-label={t('manager.kinds.stages.remove', { name: row.name || label })}
                    title={row.removable ? undefined : t('manager.kinds.stages.stays')}
                    disabled={!row.removable}
                    onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            setRows((current) => [
              ...current,
              { row: `n${String(added)}`, name: '', country: null, final: false, removable: true },
            ]);
            setAdded((n) => n + 1);
          }}
        >
          {t('manager.kinds.stages.add')}
        </Button>
        <p className="m-0 text-sm text-text-2">{t('manager.kinds.stages.note')}</p>
      </div>
    </Dialog>
  );
}
