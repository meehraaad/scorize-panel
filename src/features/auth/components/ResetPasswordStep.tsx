import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { StepHeader } from './StepHeader';

interface Props {
  pending: boolean;
  onSubmit: (password: string, confirmation: string) => void;
}

/** Opened from the link in the password-reset email (`?password_reset_token=`). */
export function ResetPasswordStep({ pending, onSubmit }: Props) {
  const { t } = useTranslation('auth');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<'required' | 'mismatch' | null>(null);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const problem = !password ? 'required' : password !== confirmation ? 'mismatch' : null;
    setError(problem);
    if (!problem) onSubmit(password, confirmation);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <StepHeader title={t('reset.title')}>{t('reset.subtitle')}</StepHeader>
      <TextField
        size="lg"
        label={t('reset.password')}
        hint={t('reset.hint')}
        error={error === 'required' ? t('password.required') : undefined}
        name="new-password"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        autoFocus
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(null);
        }}
      />
      <TextField
        size="lg"
        label={t('reset.confirm')}
        error={error === 'mismatch' ? t('reset.mismatch') : undefined}
        name="confirm-password"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => {
          setConfirmation(event.target.value);
          setError(null);
        }}
      />
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
        {t('reset.submit')}
      </Button>
    </form>
  );
}
