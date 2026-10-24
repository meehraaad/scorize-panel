import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { normalizePhone } from '@/lib/text';
import { useSaveGateProfile, type Gates, type ProfileGateField } from '@/lib/applicant/gates';

type Problem = 'required' | 'latin' | 'mobile';

function check(field: ProfileGateField, raw: string): { value: string } | { problem: Problem } {
  const value = raw.trim();
  if (!value) return { problem: 'required' };
  if (field === 'passport_name')
    return /^[A-Za-z][A-Za-z .'-]*$/.test(value) ? { value } : { problem: 'latin' };
  if (field === 'relative_phone') {
    const phone = normalizePhone(value);
    return phone ? { value: phone } : { problem: 'mobile' };
  }
  return { value };
}

/** Step 2 of starting a case: the details it can't start without (canvas V6 section 8, terms). */
export function ProfileGate({ profile }: { profile: NonNullable<Gates['profile']> }) {
  const { t } = useTranslation('gates');
  const f = useFormat();
  const save = useSaveGateProfile();
  const [values, setValues] = useState<Partial<Record<ProfileGateField, string>>>({});
  const [problems, setProblems] = useState<Partial<Record<ProfileGateField, Problem>>>({});

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const found: Partial<Record<ProfileGateField, Problem>> = {};
    const clean: Partial<Record<ProfileGateField, string>> = {};
    for (const field of profile.fields) {
      const result = check(field, values[field] ?? '');
      if ('problem' in result) found[field] = result.problem;
      else clean[field] = result.value;
    }
    setProblems(found);
    const first = profile.fields.find((field) => found[field]);
    if (first) {
      document.getElementById(`gate-${first}`)?.focus();
      return;
    }
    save.mutate(clean);
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 lg:gap-7">
      <span className="text-[13px] font-semibold text-primary-text">
        {t('terms.step', { n: f.number(2) })}
      </span>
      <SectionCard
        variant="panel"
        size="lg"
        id="gate-profile"
        title={t('profile.title')}
        subtitle={t('profile.text')}
      >
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {profile.fields.map((field) => (
            <TextField
              key={field}
              id={`gate-${field}`}
              label={t(`profile.${field}`)}
              dir={field === 'relative_name' ? 'auto' : 'ltr'}
              type={field === 'relative_phone' ? 'tel' : 'text'}
              value={values[field] ?? ''}
              error={problems[field] ? t(`profile.${problems[field]}`) : undefined}
              onChange={(event) => {
                setValues((current) => ({ ...current, [field]: event.target.value }));
                setProblems((current) => ({ ...current, [field]: undefined }));
              }}
            />
          ))}
          {save.isError && <Notice tone="error">{t('profile.error')}</Notice>}
          <Button type="submit" size="lg" disabled={save.isPending}>
            {save.isPending ? t('profile.sending') : t('profile.submit')}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
