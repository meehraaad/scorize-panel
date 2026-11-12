import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField, TextAreaField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { FileDrop, PickedFile } from '@/components/ui/Files';
import { TextField } from '@/components/ui/TextField';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';
import { uploadFile } from '@/lib/upload';
import {
  documentPath,
  fileQuery,
  HR_KEY,
  optionsQuery,
  useEditStaff,
  useNewContract,
  useNewSalary,
  useStartExit,
  type ContractKind,
  type StaffFile,
} from '../api';
import { fieldErrors, parseAmount, todayValue } from '../format';

const CONTRACTS: readonly ContractKind[] = ['trial', 'fixed', 'permanent', 'project'];

interface DialogProps {
  file: StaffFile;
  onClose: () => void;
}

function Footer({
  saveLabel,
  pending,
  onSave,
  onClose,
}: {
  saveLabel: string;
  pending: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('hr');
  return (
    <>
      <Button disabled={pending} onClick={onSave}>
        {saveLabel}
      </Button>
      <Button variant="outline" onClick={onClose}>
        {t('cancel')}
      </Button>
    </>
  );
}

/** A new work contract: a renewal, the end of a trial, another kind. */
export function ContractDialog({ file, onClose }: DialogProps) {
  const { t } = useTranslation('hr');
  const save = useNewContract(file.id);
  const last = file.contract;
  const [kind, setKind] = useState<ContractKind>(last?.kind ?? 'fixed');
  const [start, setStart] = useState(last?.end ?? todayValue());
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () =>
    save.mutate(
      { kind, start, end: kind === 'permanent' ? null : end || null, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t('contractDialog.saved'));
          onClose();
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          if (Object.keys(fieldErrors(error)).length === 0) toast.error(t('error'));
        },
      },
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('contractDialog.title')}
      subtitle={file.name}
      closeLabel={t('close')}
      footer={
        <Footer
          saveLabel={t('contractDialog.save')}
          pending={save.isPending}
          onSave={submit}
          onClose={onClose}
        />
      }
    >
      <ChoiceGroup
        legend={t('form.contract')}
        look="pills"
        value={kind}
        onChange={setKind}
        options={CONTRACTS.map((value) => ({ value, label: t(`contract.${value}`) }))}
      />
      <DatePicker
        label={t('contractDialog.start')}
        value={start}
        onChange={(value) => value && setStart(value)}
        error={errors.start}
      />
      {kind !== 'permanent' && (
        <DatePicker
          label={t('form.contractEnd')}
          value={end}
          onChange={setEnd}
          min={start}
          clearable
          error={errors.end}
        />
      )}
      <TextAreaField
        label={t('contractDialog.note')}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
      />
    </Dialog>
  );
}

/** A base salary from a day on: today's or an earlier day at once, a later one on that day. */
export function SalaryDialog({ file, onClose }: DialogProps) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const save = useNewSalary(file.id);
  const [amount, setAmount] = useState('');
  const [effective, setEffective] = useState(todayValue());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const value = parseAmount(amount);
  const submit = () => {
    if (value === null) {
      setError(t('form.required'));
      return;
    }
    save.mutate(
      { amount: value, effective, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(t('salaryDialog.saved'));
          onClose();
        },
        onError: () => toast.error(t('error')),
      },
    );
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('salaryDialog.title')}
      subtitle={
        file.pay.salary !== null
          ? t('salaryDialog.now', { amount: t('toman', { amount: f.number(file.pay.salary) }) })
          : file.name
      }
      closeLabel={t('close')}
      footer={
        <Footer
          saveLabel={t('salaryDialog.save')}
          pending={save.isPending}
          onSave={submit}
          onClose={onClose}
        />
      }
    >
      <TextField
        label={t('form.salary')}
        hint={value !== null ? t('toman', { amount: f.number(value) }) : t('form.salaryHint')}
        inputMode="numeric"
        dir="ltr"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={error}
      />
      <DatePicker
        label={t('salaryDialog.effective')}
        hint={t('salaryDialog.effectiveHint')}
        value={effective}
        onChange={(day) => day && setEffective(day)}
      />
      <TextAreaField
        label={t('salaryDialog.note')}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
      />
    </Dialog>
  );
}

/** Starts someone's leaving: their last day and why; opens the leaving checklist. */
export function ExitDialog({ file, onClose }: DialogProps) {
  const { t } = useTranslation('hr');
  const save = useStartExit(file.id);
  const [day, setDay] = useState(todayValue());
  const [reason, setReason] = useState('');
  const submit = () =>
    save.mutate(
      { day, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(t('exitDialog.saved'));
          onClose();
        },
        onError: () => toast.error(t('error')),
      },
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('exitDialog.title')}
      subtitle={file.name}
      closeLabel={t('close')}
      footer={
        <Footer
          saveLabel={t('exitDialog.save')}
          pending={save.isPending}
          onSave={submit}
          onClose={onClose}
        />
      }
    >
      <p className="m-0 text-[15px] leading-7 text-text-2">{t('exitDialog.text')}</p>
      <DatePicker
        label={t('exitDialog.day')}
        value={day}
        onChange={(value) => value && setDay(value)}
      />
      <TextAreaField
        label={t('exitDialog.reason')}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
      />
    </Dialog>
  );
}

type InfoField =
  | 'full_name'
  | 'fathers_name'
  | 'national_code'
  | 'id_number'
  | 'birth_place'
  | 'phone_number'
  | 'work_email'
  | 'address';

const TEXT_FIELDS: readonly InfoField[] = [
  'full_name',
  'fathers_name',
  'national_code',
  'id_number',
  'birth_place',
  'phone_number',
  'work_email',
  'address',
];
const LATIN: ReadonlySet<InfoField> = new Set([
  'national_code',
  'id_number',
  'phone_number',
  'work_email',
]);

/** The file's personal details, position and team. */
export function InfoDialog({ file, onClose }: DialogProps) {
  const { t } = useTranslation('hr');
  const save = useEditStaff(file.id);
  const options = useQuery(optionsQuery);
  const info = file.info;
  const [values, setValues] = useState<Record<InfoField, string>>(() => ({
    full_name: info.full_name,
    fathers_name: info.fathers_name,
    national_code: info.national_code,
    id_number: info.id_number,
    birth_place: info.birth_place,
    phone_number: info.phone_number ?? '',
    work_email: info.work_email,
    address: info.address,
  }));
  const [birth, setBirth] = useState(info.birth_date ?? '');
  const [marital, setMarital] = useState<'' | 'single' | 'married'>(info.marital_status ?? '');
  const [position, setPosition] = useState(file.position ? String(file.position.id) : '');
  const [team, setTeam] = useState<string>(file.team ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = () =>
    save.mutate(
      {
        ...values,
        phone_number: values.phone_number || null,
        birth_date: birth || null,
        marital_status: marital || null,
        position: position ? Number(position) : null,
        team: (team || null) as StaffFile['team'],
      },
      {
        onSuccess: () => {
          toast.success(t('saved'));
          onClose();
        },
        onError: (error) => {
          setErrors(fieldErrors(error));
          if (Object.keys(fieldErrors(error)).length === 0) toast.error(t('error'));
        },
      },
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('infoDialog.title')}
      subtitle={file.name}
      closeLabel={t('close')}
      footer={
        <Footer
          saveLabel={t('infoDialog.save')}
          pending={save.isPending}
          onSave={submit}
          onClose={onClose}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((field) => (
          <TextField
            key={field}
            label={t(`info.${field}`)}
            value={values[field]}
            dir={LATIN.has(field) ? 'ltr' : undefined}
            onChange={(event) => setValues({ ...values, [field]: event.target.value })}
            error={errors[field]}
          />
        ))}
      </div>
      <DatePicker
        label={t('info.birth_date')}
        value={birth}
        onChange={setBirth}
        only="past"
        clearable
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={t('info.marital_status')}
          value={marital}
          onChange={setMarital}
          options={[
            { value: '', label: t('form.none') },
            { value: 'single', label: t('marital.single') },
            { value: 'married', label: t('marital.married') },
          ]}
        />
        <SelectField
          label={t('form.position')}
          value={position}
          onChange={setPosition}
          options={[
            { value: '', label: t('form.none') },
            ...(options.data?.positions ?? []).map((item) => ({
              value: String(item.id),
              label: item.name,
            })),
          ]}
        />
        <SelectField
          label={t('form.team')}
          value={team}
          onChange={setTeam}
          options={[
            { value: '', label: t('form.none') },
            ...(options.data?.teams ?? []).map((item) => ({
              value: item,
              label: t(`team.${item}`),
            })),
          ]}
        />
      </div>
    </Dialog>
  );
}

const ACCEPT = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

/** A document for the file (a document type and a pdf, jpg or png), under the upload toast. */
export function DocumentDialog({ file, onClose }: DialogProps) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const client = useQueryClient();
  const options = useQuery(optionsQuery);
  const types = options.data?.document_types ?? [];
  const [type, setType] = useState('');
  const [picked, setPicked] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const chosen = type || (types[0] ? String(types[0].id) : '');
  const submit = async () => {
    if (!picked || !chosen) return;
    const body = new FormData();
    body.append('type', chosen);
    body.append('file', picked);
    setSending(true);
    try {
      const saved = await uploadFile<StaffFile>(documentPath(file.id), body, picked, {
        done: t('documentDialog.saved'),
      });
      client.setQueryData(fileQuery(file.id).queryKey, saved);
      void client.invalidateQueries({ queryKey: HR_KEY });
      onClose();
    } catch {
      // The upload toast already says what went wrong.
    } finally {
      setSending(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('documentDialog.title')}
      subtitle={file.name}
      closeLabel={t('close')}
      footer={
        <Footer
          saveLabel={t('documentDialog.save')}
          pending={sending || !picked || !chosen}
          onSave={() => void submit()}
          onClose={onClose}
        />
      }
    >
      <SelectField
        label={t('documentDialog.type')}
        value={chosen}
        onChange={setType}
        options={types.map((item) => ({ value: String(item.id), label: item.name }))}
      />
      {picked ? (
        <PickedFile
          ext={picked.name.split('.').pop() ?? ''}
          name={picked.name}
          meta={f.fileSize(picked.size)}
          removeLabel={t('documentDialog.remove')}
          disabled={sending}
          onRemove={() => setPicked(null)}
        />
      ) : (
        <FileDrop
          id="hr-document"
          accept={ACCEPT}
          chooseLabel={t('documentDialog.choose')}
          hint={t('documentDialog.hint')}
          touchHint={t('documentDialog.hint')}
          inputLabel={t('documentDialog.choose')}
          onFile={(next) => next && setPicked(next)}
        />
      )}
    </Dialog>
  );
}
