import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { ChoiceGroup } from '@/components/ui/Choices';
import { FloatingPanel } from '@/components/ui/FloatingPanel';
import { Icon } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  activateUnknownCall,
  attachUnknownCall,
  dismissUnknownCall,
} from '@/lib/sales/contactDrafts';
import type { ObservedCall } from '@/lib/sales/phoneCalls';
import { normalizePhone } from '@/lib/text';
import { toast } from '@/lib/toast';
import { useCreateLead, useSetSecondPhone, type LeadMatch } from '../api';
import { CallSteps, CallStrip } from './CallStrip';
import { CustomerPicker } from './CustomerPicker';

type Mode = 'new' | 'existing';
/** Where a new caller found Scorize: a tap instead of typing during the call (goes in the note). */
const ORIGINS = ['instagram', 'referral', 'site', 'google', 'webinar', 'other'] as const;
type Origin = (typeof ORIGINS)[number];
type Keep = 'second' | 'once';

/** Django's 409 when the number is another seller's open lead. */
function otherSeller(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as { code?: string; seller?: string } | null;
  return body?.code === 'other_seller' ? (body.seller ?? '') : null;
}

/**
 * A call from (or to) a number no customer of the seller's has. Step 1: the seller takes the
 * caller's name (a new account, which gets the welcome SMS) or finds the customer calling from
 * another number (and may keep it as their second phone). Then the same popup becomes that
 * customer's log. A missed call is only a small card to call back.
 */
export function UnknownCallPanel({ call }: { call: ObservedCall }) {
  const [adding, setAdding] = useState(false);
  if (call.status === 'missed' && !adding)
    return <MissedCall call={call} onAdd={() => setAdding(true)} />;
  return <UnknownCallForm call={call} />;
}

function MissedCall({ call, onAdd }: { call: ObservedCall; onAdd: () => void }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  return (
    <FloatingPanel
      title={t('callStrip.missedTitle')}
      subtitle={
        <span>
          <span dir="ltr">{f.digits(call.phone)}</span>
          {' · '}
          {f.timeAgo(call.started_at)}
        </span>
      }
      closeLabel={t('contactDraft.minimize')}
      onClose={() => activateUnknownCall(null)}
      footer={
        <>
          <a href={`tel:${call.phone}`} className={buttonClass('primary', 'flex-1')}>
            <Icon name="phone" size={18} />
            {t('callStrip.callBack')}
          </a>
          <Button variant="outline" onClick={onAdd}>
            {t('callStrip.addCustomer')}
          </Button>
          <Button variant="outline" onClick={() => dismissUnknownCall(call.id)}>
            {t('phoneCall.dismiss')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm leading-7 text-text-2">{t('callStrip.missedHint')}</p>
    </FloatingPanel>
  );
}

function UnknownCallForm({ call }: { call: ObservedCall }) {
  const { t } = useTranslation('sales');
  const f = useFormat();
  const create = useCreateLead();
  const secondPhone = useSetSecondPhone();
  const callPhone = normalizePhone(call.phone);
  const [mode, setMode] = useState<Mode>('new');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState(() => callPhone ?? call.phone);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [about, setAbout] = useState('');
  const [picked, setPicked] = useState<LeadMatch | null>(null);
  const [keep, setKeep] = useState<Keep>(callPhone ? 'second' : 'once');
  const [checked, setChecked] = useState(false);
  const pending = create.isPending || secondPhone.isPending;

  const normalized = normalizePhone(phone);
  const taken = otherSeller(create.error);
  const serverPhone =
    create.error instanceof ApiError &&
    (create.error.body as { phone?: string[] } | null)?.phone?.[0];
  const phoneError =
    (checked && !normalized) || serverPhone ? t('leads.new.phoneInvalid') : undefined;
  const nameError = checked && !first.trim() ? t('leads.new.nameRequired') : undefined;
  // The call's own number needs no field; another line (an office, abroad) has to be typed.
  const asksPhone = !callPhone || !!serverPhone;

  const continueWith = (customer: number, name: string, via: 'new' | 'picked') =>
    attachUnknownCall(call.id, customer, name, via);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setChecked(true);
    if (mode === 'existing') {
      if (!picked) return;
      if (keep === 'second' && callPhone && callPhone !== normalizePhone(picked.phone))
        secondPhone.mutate(
          { customer: picked.customer, phone: callPhone },
          {
            onSuccess: () => {
              toast.success(t('unknownCall.phoneKept', { name: picked.name }));
              continueWith(picked.customer, picked.name, 'picked');
            },
            onError: (error) => {
              toast.error(
                error instanceof ApiError && error.status === 409
                  ? t('unknownCall.phoneTaken')
                  : t('error'),
              );
              continueWith(picked.customer, picked.name, 'picked');
            },
          },
        );
      else continueWith(picked.customer, picked.name, 'picked');
      return;
    }
    if (!normalized || !first.trim()) return;
    const name = [first.trim(), last.trim()].filter(Boolean).join(' ');
    const note = [origin && t(`unknownCall.origin.${origin}`), about.trim()]
      .filter(Boolean)
      .join(' · ');
    create.mutate(
      {
        first_name: first.trim(),
        last_name: last.trim(),
        phone: normalized,
        note,
        from_call: true,
      },
      {
        onSuccess: ({ customer, existing }) => {
          toast.success(t(existing ? 'unknownCall.addedExisting' : 'unknownCall.created'));
          continueWith(customer, name, 'new');
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
      wide
      title={f.digits(call.phone)}
      closeLabel={t('contactDraft.minimize')}
      onClose={() => activateUnknownCall(null)}
      hero={(titleId) => (
        <CallStrip
          call={call}
          titleId={titleId}
          closeLabel={t('contactDraft.minimize')}
          onClose={() => activateUnknownCall(null)}
        />
      )}
      footer={
        <>
          <Button
            type="submit"
            form={`unknown-${call.id}`}
            size="lg"
            disabled={pending}
            className="min-w-0 flex-1"
          >
            <span className="truncate">
              {mode === 'existing' && picked
                ? t('unknownCall.continueWith', { name: picked.name })
                : t('unknownCall.continue')}
            </span>
            <Icon name="chevronEnd" size={18} />
          </Button>
          <Button variant="outline" size="lg" onClick={() => dismissUnknownCall(call.id)}>
            {t('unknownCall.notWork')}
          </Button>
        </>
      }
    >
      <CallSteps step={1} />
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
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label={t('leads.new.firstName')}
                value={first}
                onChange={(event) => setFirst(event.target.value)}
                error={nameError}
                autoComplete="off"
              />
              <TextField
                label={t('leads.new.lastName')}
                placeholder={t('unknownCall.optional')}
                value={last}
                onChange={(event) => setLast(event.target.value)}
                autoComplete="off"
              />
            </div>
            {asksPhone && (
              <TextField
                label={t('leads.new.phone')}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                error={phoneError}
                inputMode="tel"
                dir="ltr"
                autoComplete="off"
              />
            )}
            <ChoiceGroup
              legend={t('unknownCall.originLegend')}
              value={origin}
              onChange={(value) => setOrigin(value === origin ? null : value)}
              options={ORIGINS.map((value) => ({
                value,
                label: t(`unknownCall.origin.${value}`),
              }))}
            />
            <TextField
              label={t('unknownCall.about')}
              placeholder={t('unknownCall.notePlaceholder')}
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              autoComplete="off"
            />
            <p className="m-0 flex items-start gap-2.5 rounded-xl bg-canvas px-4 py-3 text-[13px] leading-6 text-text-2">
              <Icon name="mail" size={18} className="mt-0.5 flex-none text-primary-text" />
              {t('unknownCall.smsHint')}
            </p>
          </>
        ) : (
          <>
            <p className="m-0 text-sm leading-7 text-text-2">{t('unknownCall.existingHint')}</p>
            <CustomerPicker
              value={picked}
              onChange={setPicked}
              error={checked && !picked ? t('followUpDialog.customerRequired') : undefined}
            />
            {picked && callPhone && callPhone !== normalizePhone(picked.phone) && (
              <ChoiceGroup
                legend={t('unknownCall.keepLegend', { name: picked.name })}
                value={keep}
                onChange={setKeep}
                hint={keep === 'second' ? t('unknownCall.keepHint') : undefined}
                options={[
                  { value: 'second', label: t('unknownCall.keep.second') },
                  { value: 'once', label: t('unknownCall.keep.once') },
                ]}
              />
            )}
          </>
        )}
      </form>
    </FloatingPanel>
  );
}
