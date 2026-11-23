import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { useFormat } from '@/lib/i18n/useFormat';
import { normalizePhone } from '@/lib/text';
import { toast } from '@/lib/toast';
import { HR_KEY, optionsQuery, type ContractKind, type Team } from '../api';
import { useNewStaff } from '../mutations';
import { fieldErrors, parseAmount, todayValue } from '../format';
import { personPath } from '../paths';

const CONTRACTS: readonly ContractKind[] = ['trial', 'fixed', 'permanent', 'project'];

/**
 * A new staff member (canvas "کارمند جدید"): HR only gives what the hire can't type themselves —
 * their mobile (the login), position and team, the first day, the first contract and salary. The
 * hire types their names, ID card number and the rest on the new-hire form (until it is approved
 * the file is named by the phone). Saving makes their account and file, opens the joining
 * checklist and the form, then opens the file on the invite to send them.
 */
export default function NewStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const navigate = useNavigate();
  const options = useQuery(optionsQuery);
  const save = useNewStaff();
  const client = useQueryClient();
  const [form, setForm] = useState({
    phone: '',
    email: '',
    position: '',
    team: '' as Team | '',
    entry_date: todayValue(),
    contract: 'trial' as ContractKind,
    contract_end: '',
    salary: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (field: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const salary = parseAmount(form.salary);

  const submit = () => {
    const phone = normalizePhone(form.phone);
    const missing: Record<string, string> = {};
    if (!phone) missing.phone_number = t('form.phone');
    if (salary === null) missing.salary = t('form.required');
    setErrors(missing);
    if (Object.keys(missing).length > 0 || !phone || salary === null) return;
    save.mutate(
      {
        phone_number: phone,
        email: form.email.trim(),
        position: form.position ? Number(form.position) : null,
        team: form.team || null,
        entry_date: form.entry_date,
        contract: form.contract,
        contract_end: form.contract === 'permanent' ? null : form.contract_end || null,
        salary,
      },
      {
        onSuccess: (file) => {
          toast.success(t('newStaff.saved'));
          onClose();
          // With the form on: its tab first, where the invite to send the hire is.
          void navigate(
            personPath(file.id),
            ON_SERVER.hrOnboarding ? { state: { tab: 'form' } } : undefined,
          );
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            // Saved by someone else at the same moment (the same phone or email): the list shows it.
            toast.error(t('newStaff.exists'));
            void client.invalidateQueries({ queryKey: HR_KEY });
            return;
          }
          const fields = fieldErrors(error);
          setErrors(fields);
          if (Object.keys(fields).length === 0) toast.error(t('error'));
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('newStaff.title')}
      subtitle={t('newStaff.subtitle')}
      closeLabel={t('close')}
      footer={
        <>
          <Button disabled={save.isPending} onClick={submit}>
            {t('newStaff.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <TextField
        label={t('form.mobile')}
        hint={t('form.mobileHint')}
        value={form.phone}
        inputMode="tel"
        dir="ltr"
        autoComplete="off"
        onChange={(event) => set('phone')(event.target.value)}
        error={errors.phone_number}
      />
      <TextField
        label={t('form.email')}
        hint={t('form.emailHint')}
        type="email"
        dir="ltr"
        value={form.email}
        onChange={(event) => set('email')(event.target.value)}
        error={errors.email}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label={t('form.position')}
          value={form.position}
          onChange={set('position')}
          options={[
            { value: '', label: t('form.none') },
            ...(options.data?.positions ?? []).map((position) => ({
              value: String(position.id),
              label: position.name,
            })),
          ]}
          error={errors.position}
        />
        <SelectField
          label={t('form.team')}
          value={form.team}
          onChange={set('team')}
          options={[
            { value: '', label: t('form.none') },
            ...(options.data?.teams ?? []).map((team) => ({
              value: team,
              label: t(`team.${team}`),
            })),
          ]}
        />
      </div>
      <DatePicker
        label={t('form.entryDate')}
        value={form.entry_date}
        onChange={(value) => value && set('entry_date')(value)}
        error={errors.entry_date}
      />
      <ChoiceGroup
        legend={t('form.contract')}
        look="pills"
        value={form.contract}
        onChange={(value) => setForm((current) => ({ ...current, contract: value }))}
        options={CONTRACTS.map((value) => ({ value, label: t(`contract.${value}`) }))}
      />
      {form.contract !== 'permanent' && (
        <DatePicker
          label={t('form.contractEnd')}
          value={form.contract_end}
          onChange={set('contract_end')}
          min={form.entry_date}
          clearable
          error={errors.contract_end}
        />
      )}
      <TextField
        label={t('form.salary')}
        hint={salary !== null ? t('toman', { amount: f.number(salary) }) : t('form.salaryHint')}
        inputMode="numeric"
        dir="ltr"
        value={form.salary}
        onChange={(event) => set('salary')(event.target.value)}
        error={errors.salary}
      />
    </Dialog>
  );
}
