import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { useUser } from '@/lib/auth/session';
import { useFormat } from '@/lib/i18n/useFormat';
import { useAcceptTerms, type Gates } from '@/lib/applicant/gates';

/** Step 1 of starting a case: read and accept the terms (canvas V6 section 8, terms). */
export function TermsGate({ terms }: { terms: NonNullable<Gates['terms']> }) {
  const { t } = useTranslation('gates');
  const f = useFormat();
  const user = useUser();
  const accept = useAcceptTerms();
  const [checked, setChecked] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (checked) accept.mutate(terms.version);
  };

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 lg:gap-7">
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-semibold text-primary-text">
          {t('terms.step', { n: f.number(1) })}
        </span>
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">
          {user.first_name ? t('terms.title', { name: user.first_name }) : t('terms.titleNoName')}
        </h1>
        <p className="m-0 text-base leading-8 text-text-2">{t('terms.text')}</p>
      </div>
      <Card className="flex flex-col">
        <div
          tabIndex={0}
          role="region"
          aria-label={t('terms.label')}
          className="flex max-h-[420px] flex-col gap-5 overflow-y-auto p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus lg:px-7"
        >
          {terms.sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1.5">
              <h2 className="m-0 text-base font-bold">{section.title}</h2>
              <p className="m-0 text-[15px] leading-8 whitespace-pre-line text-text-2">
                {section.text}
              </p>
            </div>
          ))}
        </div>
        <form
          noValidate
          onSubmit={submit}
          className="flex flex-wrap items-center justify-between gap-4 p-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-7"
        >
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-medium">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="size-5 accent-primary"
            />
            {t('terms.accept')}
          </label>
          <Button type="submit" disabled={!checked || accept.isPending} className="max-sm:w-full">
            {accept.isPending ? t('terms.sending') : t('terms.submit')}
          </Button>
          {accept.isError && (
            <div className="w-full">
              <Notice tone="error">{t('terms.error')}</Notice>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
