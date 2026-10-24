import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { Notice } from '@/components/ui/Notice';
import { normalizePhone } from '@/lib/text';
import { useSaveWriting } from '../api';
import type { FormType } from '../formSpec';
import { useFormText } from '../useFormText';

const TIPS = ['0', '1', '2', '3'] as const;

export function TipsCard({ type }: { type: FormType }) {
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  return (
    <SectionCard variant="panel" id={`${type}-tips`} title={t('tipsTitle')}>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {TIPS.map((tip) => (
          <li key={tip} className="flex gap-2.5 text-sm leading-7">
            <span
              aria-hidden="true"
              className="mt-[11px] size-1.5 flex-none rounded-full bg-primary"
            />
            {text(`tips.${tip}`)}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** The number the writer calls to coordinate. */
export function PhoneCard({
  type,
  phone,
  readOnly,
}: {
  type: FormType;
  phone: string | null;
  readOnly: boolean;
}) {
  const { t } = useTranslation('writing');
  const save = useSaveWriting(type);
  const [value, setValue] = useState(phone ?? '');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const normalized = normalizePhone(value);
    if (!normalized) {
      setInvalid(true);
      return;
    }
    setValue(normalized);
    save.mutate({ contact_phone: normalized });
  };

  return (
    <SectionCard variant="panel" id="writing-phone" title={t('phone.title')}>
      <span id="writing-phone-text" className="text-[13px] leading-7 text-text-2">
        {t('phone.text')}
      </span>
      <form onSubmit={submit} noValidate className="flex flex-col gap-2">
        <div className="flex gap-2">
          <label htmlFor="writing-phone-input" className="sr-only">
            {t('phone.label')}
          </label>
          <input
            id="writing-phone-input"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            value={value}
            disabled={readOnly}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={
              invalid ? 'writing-phone-text writing-phone-error' : 'writing-phone-text'
            }
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
              save.reset();
            }}
            className="h-11 min-w-0 flex-1 rounded-full bg-canvas px-4 text-end text-[15px] text-text shadow-[inset_0_0_0_1px_var(--line-2)] outline-0 focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]"
          />
          {!readOnly && (
            <Button type="submit" variant="outline" disabled={save.isPending} className="flex-none">
              {t('phone.save')}
            </Button>
          )}
        </div>
        {invalid && (
          <span id="writing-phone-error" className="text-[13px] leading-7 text-danger">
            {t('phone.invalid')}
          </span>
        )}
        {save.isSuccess && <Notice tone="success">{t('phone.saved')}</Notice>}
        {save.isError && <Notice tone="error">{t('phone.error')}</Notice>}
      </form>
    </SectionCard>
  );
}
