import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import type { Identifier } from '../api';
import { parseIdentifier } from '../identifier';
import { StepHeader } from './StepHeader';
import { StepNote, TermsNote } from './StepParts';

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
    <form noValidate onSubmit={submit} className="flex flex-col gap-7">
      <StepHeader title={t('identify.title')}>{t('identify.subtitle')}</StepHeader>
      <TextField
        size="lg"
        label={t('identify.label')}
        // Tells the user what happens next: an SMS code, or their password.
        hint={t(value.includes('@') ? 'identify.hintEmail' : 'identify.hintPhone')}
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
        placeholder={t('identify.placeholder')}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError(false);
        }}
        className="text-start"
      />
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
        {t('identify.submit')}
        <Icon name="chevronEnd" size={18} />
      </Button>
      <StepNote icon="lock" tone="good">
        {t('identify.privacy')}
      </StepNote>
      <TermsNote i18nKey="identify.terms" />
    </form>
  );
}
