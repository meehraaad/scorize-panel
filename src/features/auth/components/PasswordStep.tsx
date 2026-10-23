import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { StepHeader } from './StepHeader';

interface Props {
  email: string;
  pending: boolean;
  onSubmit: (password: string) => void;
  onForgot: () => void;
  onChangeEmail: () => void;
}

export function PasswordStep({ email, pending, onSubmit, onForgot, onChangeEmail }: Props) {
  const { t } = useTranslation('auth');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [missing, setMissing] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setMissing(!password);
    if (password) onSubmit(password);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <StepHeader title={t('password.title')}>{t('password.subtitle', { email })}</StepHeader>
      {/* Lets password managers save and fill the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <TextField
        label={t('password.label')}
        error={missing ? t('password.required') : undefined}
        name="password"
        type={visible ? 'text' : 'password'}
        dir="ltr"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setMissing(false);
        }}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={t(visible ? 'password.hide' : 'password.show')}
            aria-pressed={visible}
            className="inline-flex size-10 items-center justify-center rounded-full text-text-2 hover:text-text"
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} />
          </button>
        }
      />
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
        {t('password.submit')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
        <button
          type="button"
          onClick={onForgot}
          disabled={pending}
          className="min-h-11 font-medium text-primary-text"
        >
          {t('password.forgot')}
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="min-h-11 text-text-2 hover:text-text"
        >
          {t('password.changeEmail')}
        </button>
      </div>
    </form>
  );
}
