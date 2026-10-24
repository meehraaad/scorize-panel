import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { SectionCard } from '@/components/ui/SectionCard';
import { Notice } from '@/components/ui/Notice';
import { normalizePhone } from '@/lib/text';
import { useSaveWriting } from '../api';
import type { FormSpec, FormType } from '../formSpec';
import { useFormText } from '../useFormText';

/** The side column of a writing form, as its spec asks (see FormSpec.aside). */
export function FormAside({
  spec,
  phone,
  readOnly,
}: {
  spec: FormSpec;
  phone: string | null;
  readOnly: boolean;
}) {
  const { aside, type } = spec;
  return (
    <>
      <TipsCard type={type} count={aside.tips} ownTitle={aside.ownTitle ?? false} />
      {aside.phone && <PhoneCard type={type} phone={phone} readOnly={readOnly} />}
      {aside.ticket && <TicketCard type={type} />}
    </>
  );
}

function TipsCard({ type, count, ownTitle }: { type: FormType; count: number; ownTitle: boolean }) {
  const { t } = useTranslation('writing');
  const { text } = useFormText(type);
  return (
    <SectionCard
      variant="panel"
      id={`${type}-tips`}
      title={ownTitle ? text('tipsTitle') : t('tipsTitle')}
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {Array.from({ length: count }, (_, index) => String(index)).map((tip) => (
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

/** Questions go to the writer through the writing ticket. */
function TicketCard({ type }: { type: FormType }) {
  const { t } = useTranslation('writing');
  return (
    <SectionCard variant="panel" id={`${type}-ask`} title={t('ask.title')}>
      <span className="text-sm leading-7 text-text-2">{t('ask.text')}</span>
      <Link to={`/tickets/writing/${type}`} className={buttonClass('outline', 'self-start')}>
        {t('tabs.ticket')}
      </Link>
    </SectionCard>
  );
}

/** The number the writer calls to coordinate. */
function PhoneCard({
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
