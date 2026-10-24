import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Choices';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { normalizePhone } from '@/lib/text';
import { useCreateLead } from '../api';
import { customerPath } from '../paths';

/** A lead the seller found themselves (referral, walk-in). Opens the new customer's page. */
export function NewLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('sales');
  const navigate = useNavigate();
  const create = useCreateLead();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);

  const normalized = normalizePhone(phone);
  const serverPhone =
    create.error instanceof ApiError &&
    (create.error.body as { phone?: string[] } | null)?.phone?.[0];
  const phoneError =
    checked && !normalized
      ? t('leads.new.phoneInvalid')
      : serverPhone === 'exists'
        ? t('leads.new.phoneExists')
        : serverPhone
          ? t('leads.new.phoneInvalid')
          : undefined;
  const nameError = checked && !first.trim() ? t('leads.new.nameRequired') : undefined;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (!normalized || !first.trim()) return;
    create.mutate(
      { first_name: first.trim(), last_name: last.trim(), phone: normalized, note: note.trim() },
      {
        onSuccess: ({ customer }) => {
          void navigate(customerPath(customer));
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('leads.new.title')}
      subtitle={t('leads.new.subtitle')}
      closeLabel={t('close')}
      footer={
        <>
          <Button type="submit" form="new-lead" disabled={create.isPending}>
            {t('leads.new.save')}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        </>
      }
    >
      <form id="new-lead" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('leads.new.firstName')}
            value={first}
            onChange={(event) => setFirst(event.target.value)}
            error={nameError}
            autoComplete="off"
          />
          <TextField
            label={t('leads.new.lastName')}
            value={last}
            onChange={(event) => setLast(event.target.value)}
            autoComplete="off"
          />
        </div>
        <TextField
          label={t('leads.new.phone')}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={phoneError}
          inputMode="tel"
          dir="ltr"
          autoComplete="off"
        />
        <TextAreaField
          label={t('leads.new.note')}
          placeholder={t('leads.new.notePlaceholder')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
        />
        {create.isError && !serverPhone && <Notice tone="error">{t('error')}</Notice>}
      </form>
    </Dialog>
  );
}
