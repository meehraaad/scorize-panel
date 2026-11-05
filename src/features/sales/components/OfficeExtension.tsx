import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { officeExtensionQuery, useSetOfficeExtension } from '@/lib/sales/phoneCalls';
import { toLatinDigits } from '@/lib/text';
import { toast } from '@/lib/toast';

const EXTENSION = /^[1-9]\d{2}$/;

/** Settings: the seller picks the office desk phone whose calls pop up in their panel. */
export function OfficeExtension() {
  const { t } = useTranslation('sales');
  const saved = useQuery(officeExtensionQuery);
  const save = useSetOfficeExtension();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved.data?.extension ?? '';
  const digits = toLatinDigits(value).trim();
  const invalid = digits !== '' && !EXTENSION.test(digits);
  const taken = save.error instanceof ApiError && save.error.status === 409;

  const submit = (extension: string | null) =>
    save.mutate(extension, {
      onSuccess: () => {
        setDraft(null);
        toast.success(extension ? t('officeExtension.saved') : t('officeExtension.cleared'));
      },
      onError: (error) => {
        if (!(error instanceof ApiError && error.status === 409)) toast.error(t('officeExtension.error'));
      },
    });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid) submit(digits || null);
  };

  return (
    <form onSubmit={onSubmit} className="m-0 flex flex-col gap-3">
      <h2 className="mb-3 font-display text-lg font-bold">{t('officeExtension.title')}</h2>
      <TextField
        label={t('officeExtension.label')}
        hint={t('officeExtension.hint')}
        error={
          invalid ? t('officeExtension.invalid') : taken ? t('officeExtension.taken') : undefined
        }
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        value={value}
        disabled={saved.isPending}
        onChange={(event) => {
          save.reset();
          setDraft(event.target.value);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={invalid || save.isPending || saved.isPending}>
          {t('officeExtension.save')}
        </Button>
        {saved.data?.extension && (
          <Button variant="outline" disabled={save.isPending} onClick={() => submit(null)}>
            {t('officeExtension.clear')}
          </Button>
        )}
      </div>
    </form>
  );
}
