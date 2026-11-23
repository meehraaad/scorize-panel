import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, SelectField } from '@/components/ui/Choices';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { SuggestField } from '@/components/ui/SuggestField';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { ON_SERVER } from '@/lib/applicant/onServer';
import { isPersianText } from '@/lib/identity';
import { useFormat } from '@/lib/i18n/useFormat';
import { normalizePhone } from '@/lib/text';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { accountSearchQuery, phonePrefix, type AccountMatch } from '../accounts';
import { HR_KEY, optionsQuery, type ContractKind, type Team } from '../api';
import { useNewStaff } from '../mutations';
import { fieldErrors, parseAmount, todayValue } from '../format';
import { personPath } from '../paths';

const CONTRACTS: readonly ContractKind[] = ['trial', 'fixed', 'permanent', 'project'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Form = {
  first_name?: string;
  last_name?: string;
  phone: string;
  email?: string;
  position: string;
  team: Team | '';
  entry_date: string;
  contract: ContractKind;
  contract_end: string;
  salary: string;
};
type Key = keyof Form;

/**
 * A new staff member (canvas "کارمند جدید"): HR gives the hire's names and mobile (their login),
 * position and team, the first day, the first contract and salary; the hire types the rest on the
 * new-hire form. With OB12 the mobile finds an account the person already has on the site: its
 * names and email fill in, and someone already on staff can't get a second file. Saving makes their
 * account and file, opens the joining checklist and the form, then opens the file on the invite.
 */
export default function NewStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('hr');
  const f = useFormat();
  const navigate = useNavigate();
  const client = useQueryClient();
  const options = useQuery(optionsQuery);
  const save = useNewStaff();
  const [form, setForm] = useState<Form>({
    phone: '',
    position: '',
    team: '',
    entry_date: todayValue(),
    contract: 'trial',
    contract_end: '',
    salary: '',
  });
  const [touched, setTouched] = useState<ReadonlySet<Key>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const set = (field: Key) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (serverErrors[field]) setServerErrors(({ [field]: _gone, ...rest }) => rest);
  };
  const touch = (field: Key) => () => {
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  };

  const phone = normalizePhone(form.phone);
  const salary = parseAmount(form.salary);
  const contractEnd = form.contract === 'permanent' ? '' : form.contract_end;

  // OB12: live search of accounts by the start of the mobile (from 4 digits, after a pause in
  // typing); the whole number's account fills the names and email.
  const prefix = phonePrefix(form.phone);
  const settledPrefix = useDebouncedValue(prefix);
  const lookup = useQuery({
    ...accountSearchQuery(settledPrefix ?? ''),
    enabled: ON_SERVER.hrAccountLookup && Boolean(settledPrefix),
  });
  const matches = settledPrefix && settledPrefix === prefix ? (lookup.data ?? []) : [];
  const account: AccountMatch | null =
    (phone && matches.find((match) => match.phone_number === phone)) || null;
  // Derive suggestions from the current phone. An explicit edit, including clearing a field, wins.
  const existing = account && !account.staff_id ? account : null;
  const firstName = form.first_name ?? existing?.first_name ?? '';
  const lastName = form.last_name ?? existing?.last_name ?? '';
  const email = form.email ?? existing?.email ?? '';

  // What is wrong, field by field (shown once the field is left, or on save).
  const problems: Partial<Record<Key, string>> = {};
  const name = (value: string) =>
    !value.trim() ? t('form.required') : isPersianText(value) ? null : t('form.persian');
  const first = name(firstName);
  if (first) problems.first_name = first;
  const last = name(lastName);
  if (last) problems.last_name = last;
  if (!phone) problems.phone = form.phone.trim() ? t('form.phone') : t('form.required');
  else if (account?.staff_id) problems.phone = t('form.hasFile');
  if (email.trim() && !EMAIL.test(email.trim())) problems.email = t('form.emailBad');
  if (salary === null) problems.salary = t('form.required');
  else if (salary <= 0) problems.salary = t('form.salaryZero');
  if (contractEnd && contractEnd < form.entry_date) problems.contract_end = t('form.endBefore');

  const errorOf = (field: Key, server = field as string) =>
    serverErrors[server] ?? (attempted || touched.has(field) ? problems[field] : undefined);

  // A double click sends once: `disabled` only lands on the next render, the ref at once.
  const sending = useRef(false);
  const submit = () => {
    setAttempted(true);
    if (sending.current || Object.keys(problems).length > 0 || !phone || salary === null) return;
    sending.current = true;
    save.mutate(
      {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone,
        email: email.trim(),
        position: form.position ? Number(form.position) : null,
        team: form.team || null,
        entry_date: form.entry_date,
        contract: form.contract,
        contract_end: contractEnd || null,
        salary,
      },
      {
        onSettled: () => {
          sending.current = false;
        },
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
          setServerErrors(fields);
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
      <SuggestField
        label={t('form.mobile')}
        hint={t('form.mobileHint')}
        value={form.phone}
        inputMode="tel"
        dir="ltr"
        onValue={set('phone')}
        onBlur={touch('phone')}
        suggestions={matches.map((match) => match.phone_number)}
        listLabel={t('newStaff.accounts')}
        describe={(number) => {
          const match = matches.find((one) => one.phone_number === number);
          const name = match ? `${match.first_name} ${match.last_name}`.trim() : '';
          return (
            <span className="flex w-full items-center justify-between gap-3">
              <span dir="ltr">{number}</span>
              <span className="truncate text-small text-text-2">
                {match?.staff_id ? t('newStaff.onStaff', { name }) : name}
              </span>
            </span>
          );
        }}
        // A file already made for this number is said at once: no need to leave the field.
        error={account?.staff_id ? problems.phone : errorOf('phone', 'phone_number')}
      />
      {account?.staff_id && (
        <Link to={personPath(account.staff_id)} className="-mt-2 text-small text-primary-text">
          {t('newStaff.openFile')}
        </Link>
      )}
      {existing && (
        <Notice tone="info">
          {t('newStaff.account', {
            name: `${existing.first_name} ${existing.last_name}`.trim() || form.phone,
          })}
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('form.firstName')}
          value={firstName}
          autoComplete="off"
          maxLength={150}
          onChange={(event) => set('first_name')(event.target.value)}
          onBlur={touch('first_name')}
          error={errorOf('first_name')}
        />
        <TextField
          label={t('form.lastName')}
          value={lastName}
          autoComplete="off"
          maxLength={150}
          onChange={(event) => set('last_name')(event.target.value)}
          onBlur={touch('last_name')}
          error={errorOf('last_name')}
        />
      </div>
      <TextField
        label={t('form.email')}
        hint={t('form.emailHint')}
        type="email"
        dir="ltr"
        value={email}
        onChange={(event) => set('email')(event.target.value)}
        onBlur={touch('email')}
        error={errorOf('email')}
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
          error={serverErrors.position}
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
        error={serverErrors.entry_date}
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
          error={serverErrors.contract_end ?? (attempted ? problems.contract_end : undefined)}
        />
      )}
      <TextField
        label={t('form.salary')}
        hint={
          salary !== null && salary > 0
            ? t('toman', { amount: f.number(salary) })
            : t('form.salaryHint')
        }
        inputMode="numeric"
        dir="ltr"
        value={form.salary}
        onChange={(event) => set('salary')(event.target.value)}
        onBlur={touch('salary')}
        error={errorOf('salary')}
      />
    </Dialog>
  );
}
