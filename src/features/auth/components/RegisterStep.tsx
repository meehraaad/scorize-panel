import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import type { Identifier, RegistrationDetails } from '../api';
import { normalizeEmail, normalizePhone } from '../identifier';
import { StepHeader } from './StepHeader';

interface Props {
  identifier: Identifier;
  /** Field names Django rejected (its messages are not shown; ours are translated). */
  serverErrors: string[];
  pending: boolean;
  onSubmit: (details: RegistrationDetails) => void;
  onBack: () => void;
}

type Field = keyof RegistrationDetails;

export function RegisterStep({ identifier, serverErrors, pending, onSubmit, onBack }: Props) {
  const { t } = useTranslation('auth');
  const format = useFormat();
  // The identifier the user started with is locked: Django keeps it from the first step anyway.
  const [values, setValues] = useState<RegistrationDetails>({
    first_name: '',
    last_name: '',
    email: identifier.type === 'email' ? identifier.value : '',
    phone_number: identifier.type === 'phone' ? identifier.value : '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const validate = (draft: RegistrationDetails) => {
    const next: Partial<Record<Field, string>> = {};
    if (!draft.first_name.trim()) next.first_name = t('register.required');
    if (!draft.last_name.trim()) next.last_name = t('register.required');
    if (!draft.email.trim()) next.email = t('register.required');
    else if (!normalizeEmail(draft.email)) next.email = t('register.invalidEmail');
    if (!draft.phone_number.trim()) next.phone_number = t('register.required');
    else if (!normalizePhone(draft.phone_number)) next.phone_number = t('register.invalidPhone');
    return next;
  };

  const errorFor = (field: Field) =>
    errors[field] ??
    (serverErrors.includes(field) ? t(`register.serverErrors.${field}`) : undefined);

  const update = (field: Field) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  // Validate a field when the user leaves it, not while they type.
  const blur = (field: Field) => () => {
    const message = validate(values)[field];
    if (values[field] && message) setErrors((current) => ({ ...current, [field]: message }));
  };

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      email: normalizeEmail(values.email) ?? values.email,
      phone_number: normalizePhone(values.phone_number) ?? values.phone_number,
    });
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <StepHeader title={t('register.title')}>
        {t('register.subtitle', {
          identifier:
            identifier.type === 'phone' ? format.digits(identifier.value) : identifier.value,
        })}
      </StepHeader>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t('register.firstName')}
          error={errorFor('first_name')}
          name="given-name"
          autoComplete="given-name"
          autoFocus
          value={values.first_name}
          onChange={update('first_name')}
          onBlur={blur('first_name')}
        />
        <TextField
          label={t('register.lastName')}
          error={errorFor('last_name')}
          name="family-name"
          autoComplete="family-name"
          value={values.last_name}
          onChange={update('last_name')}
          onBlur={blur('last_name')}
        />
      </div>
      <TextField
        label={t('register.email')}
        error={errorFor('email')}
        name="email"
        type="email"
        dir="ltr"
        autoComplete="email"
        autoCapitalize="off"
        spellCheck={false}
        readOnly={identifier.type === 'email'}
        value={values.email}
        onChange={update('email')}
        onBlur={blur('email')}
      />
      <TextField
        label={t('register.phone')}
        hint={t('register.phoneHint')}
        error={errorFor('phone_number')}
        name="tel"
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel-national"
        readOnly={identifier.type === 'phone'}
        value={values.phone_number}
        onChange={update('phone_number')}
        onBlur={blur('phone_number')}
      />
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
        {t('register.submit')}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 self-start text-[15px] text-text-2 hover:text-text"
      >
        {t('register.back')}
      </button>
    </form>
  );
}
