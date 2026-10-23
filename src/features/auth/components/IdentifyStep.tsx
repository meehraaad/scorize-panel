import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import type { Identifier } from '../api';
import { parseIdentifier } from '../identifier';
import { StepHeader } from './StepHeader';

interface Props {
  initial: string;
  pending: boolean;
  onSubmit: (identifier: Identifier) => void;
}

export function IdentifyStep({ initial, pending, onSubmit }: Props) {
  const { t } = useTranslation('auth');
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const identifier = parseIdentifier(value);
    setError(!identifier);
    if (identifier) onSubmit(identifier);
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <StepHeader title={t('identify.title')}>{t('identify.subtitle')}</StepHeader>
      <TextField
        label={t('identify.label')}
        hint={t('identify.hint')}
        error={error ? t('identify.invalid') : undefined}
        name="username"
        type="text"
        dir="ltr"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError(false);
        }}
        className="text-start"
      />
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
        {t('identify.submit')}
      </Button>
    </form>
  );
}
