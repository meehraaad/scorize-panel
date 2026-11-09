import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { ChoiceGroup, TextAreaField } from '@/components/ui/Choices';
import { FloatingPanel } from '@/components/ui/FloatingPanel';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import {
  activateUnknownCall,
  attachUnknownCall,
  dismissUnknownCall,
} from '@/lib/sales/contactDrafts';
import type { ObservedCall } from '@/lib/sales/phoneCalls';
import { normalizePhone } from '@/lib/text';
import { toast } from '@/lib/toast';
import { useCreateLead, type LeadMatch } from '../api';
import { CallStatus } from './CallStatus';
import { CustomerPicker } from './CustomerPicker';

type Mode = 'new' | 'existing';

/** Django's 409 when the number is another seller's open lead. */
function otherSeller(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as { code?: string; seller?: string } | null;
  return body?.code === 'other_seller' ? (body.seller ?? '') : null;
}

/**
 * A call from (or to) a number no customer of the seller's has. The seller takes the caller's name
 * (a new account, which gets the welcome SMS) or finds the customer, and the same popup turns into
 * that customer's session log.
 */
export function UnknownCallPanel({ call }: { call: ObservedCall }) {
  const { t } = useTranslation('sales');
  const create = useCreateLead();
  const [mode, setMode] = useState<Mode>('new');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState(() => normalizePhone(call.phone) ?? call.phone);
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<LeadMatch | null>(null);
  const [checked, setChecked] = useState(false);

  const normalized = normalizePhone(phone);
  const taken = otherSeller(create.error);
  const serverPhone =
    create.error instanceof ApiError &&
    (create.error.body as { phone?: string[] } | null)?.phone?.[0];
  const phoneError =
    (checked && !normalized) || serverPhone ? t('leads.new.phoneInvalid') : undefined;
  const nameError = checked && !first.trim() ? t('leads.new.nameRequired') : undefined;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecked(true);
    if (mode === 'existing') {
      if (picked) attachUnknownCall(call.id, picked.customer, picked.name);
      return;
    }
    if (!normalized || !first.trim()) return;
    const name = [first.trim(), last.trim()].filter(Boolean).join(' ');
    create.mutate(
      {
        first_name: first.trim(),
        last_name: last.trim(),
        phone: normalized,
        note: note.trim(),
        from_call: true,
      },
      {
        onSuccess: ({ customer, existing }) => {
          toast.success(t(existing ? 'unknownCall.addedExisting' : 'unknownCall.created'));
          attachUnknownCall(call.id, customer, name);
        },
        onError: (error) => {
          const refused =
            error instanceof ApiError &&
            (error.status === 409 || (error.body as { phone?: unknown } | null)?.phone);
          if (!refused) toast.error(t('error'));
        },
      },
    );
  };

  return (
    <FloatingPanel
      icon="phone"
      title={t('phoneCall.unknown')}
      subtitle={t('unknownCall.subtitle')}
      closeLabel={t('contactDraft.minimize')}
      onClose={() => activateUnknownCall(null)}
      summary={<CallStatus call={call} />}
      footer={
        <>
          <Button type="submit" form={`unknown-${call.id}`} disabled={create.isPending}>
            {t(mode === 'new' ? 'unknownCall.create' : 'unknownCall.pick')}
          </Button>
          <Button variant="outline" onClick={() => dismissUnknownCall(call.id)}>
            {t('phoneCall.dismiss')}
          </Button>
        </>
      }
    >
      <form id={`unknown-${call.id}`} noValidate onSubmit={submit} className="flex flex-col gap-5">
        <ChoiceGroup
          legend={t('unknownCall.who')}
          hideLegend
          look="segmented"
          value={mode}
          onChange={(value) => {
            setMode(value);
            setChecked(false);
          }}
          options={[
            { value: 'new', label: t('unknownCall.mode.new') },
            { value: 'existing', label: t('unknownCall.mode.existing') },
          ]}
        />
        {mode === 'new' ? (
          <>
            {taken !== null && (
              <Notice tone="warn">
                {taken
                  ? t('unknownCall.otherSeller', { seller: taken })
                  : t('unknownCall.otherSellerUnnamed')}
              </Notice>
            )}
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
              placeholder={t('unknownCall.notePlaceholder')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
            />
            <p className="m-0 text-sm text-text-2">{t('unknownCall.smsHint')}</p>
          </>
        ) : (
          <CustomerPicker
            value={picked}
            onChange={setPicked}
            error={checked && !picked ? t('followUpDialog.customerRequired') : undefined}
          />
        )}
      </form>
    </FloatingPanel>
  );
}
