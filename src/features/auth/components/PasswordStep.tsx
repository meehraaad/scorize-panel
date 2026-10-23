import { useState, type SubmitEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { StepHeader } from './StepHeader';
import { BackButton, Identifier } from './StepParts';

interface Props {
  email: string;
  pending: boolean;
  onSubmit: (password: string) => void;
  onForgot: () => void;
  onChangeEmail: () => void;
  /** Log in with an SMS code instead (needs the mobile number). */
  onUseSms: () => void;
}

export function PasswordStep({
  email,
  pending,
  onSubmit,
  onForgot,
  onChangeEmail,
  onUseSms,
}: Props) {
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
    <form noValidate onSubmit={submit} className="flex flex-col gap-[26px]">
      <BackButton onClick={onChangeEmail}>{t('password.changeEmail')}</BackButton>
      <StepHeader title={t('password.title')}>
        <Trans
          ns="auth"
          i18nKey="password.subtitle"
          values={{ email }}
          components={{ id: <Identifier /> }}
        />
      </StepHeader>
      {/* Lets password managers save and fill the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <TextField
        size="lg"
        label={t('password.label')}
        labelAside={
          <button
            type="button"
            onClick={onForgot}
            disabled={pending}
            className="min-h-11 text-sm text-primary-text hover:underline"
          >
            {t('password.forgot')}
          </button>
        }
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
            className="inline-flex size-11 items-center justify-center rounded-[14px] text-text-2 hover:text-text"
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} />
          </button>
        }
      />
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
        {t('password.submit')}
      </Button>
      <Button variant="outline" size="lg" onClick={onUseSms} className="w-full">
        {t('password.useSms')}
      </Button>
    </form>
  );
}
