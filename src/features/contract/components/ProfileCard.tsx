import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { formatPhone } from '@/lib/site';
import { normalizePhone, toLatinDigits } from '@/lib/text';
import { PROFILE_FIELDS, useSaveProfileField, type ContractData, type ProfileField } from '../api';

type Problem = 'required' | 'email' | 'mobile' | 'phone' | 'tenDigits' | 'latin';

interface FieldRule {
  /** Written left to right (Latin letters, numbers). */
  ltr: boolean;
  input: 'text' | 'email' | 'tel' | 'numeric';
  autoComplete?: string;
  /** The value to send, or why it can't be sent. */
  check: (value: string) => { value: string } | { problem: Problem };
}

const digitsOnly = (value: string) => toLatinDigits(value).replace(/[\s\-()]/g, '');

const required =
  (next: FieldRule['check']): FieldRule['check'] =>
  (value) =>
    value.trim() ? next(value.trim()) : { problem: 'required' };

const RULES: Partial<Record<ProfileField, FieldRule>> = {
  phone: {
    ltr: true,
    input: 'tel',
    autoComplete: 'tel',
    check: required((value) => {
      const phone = normalizePhone(value);
      return phone ? { value: phone } : { problem: 'mobile' };
    }),
  },
  national_id: {
    ltr: true,
    input: 'numeric',
    check: required((value) =>
      /^\d{10}$/.test(digitsOnly(value)) ? { value: digitsOnly(value) } : { problem: 'tenDigits' },
    ),
  },
  passport_name: {
    ltr: true,
    input: 'text',
    check: required((value) =>
      /^[A-Za-z][A-Za-z .'-]*$/.test(value) ? { value } : { problem: 'latin' },
    ),
  },
  postal_code: {
    ltr: true,
    input: 'numeric',
    autoComplete: 'postal-code',
    check: required((value) =>
      /^\d{10}$/.test(digitsOnly(value)) ? { value: digitsOnly(value) } : { problem: 'tenDigits' },
    ),
  },
  home_phone: {
    ltr: true,
    input: 'tel',
    check: required((value) =>
      /^0\d{10}$/.test(digitsOnly(value)) ? { value: digitsOnly(value) } : { problem: 'phone' },
    ),
  },
  address_en: {
    ltr: true,
    input: 'text',
    check: required((value) => (/^[\x20-\x7E\n]+$/.test(value) ? { value } : { problem: 'latin' })),
  },
  relative_name: { ltr: false, input: 'text', check: required((value) => ({ value })) },
  relative_phone: {
    ltr: true,
    input: 'tel',
    check: required((value) => {
      const phone = normalizePhone(value);
      return phone ? { value: phone } : { problem: 'mobile' };
    }),
  },
  relative_email: {
    ltr: true,
    input: 'email',
    check: required((value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { value } : { problem: 'email' },
    ),
  },
};

/** Fields shown left to right even though nobody edits them here. */
const LTR_READONLY = new Set<ProfileField>(['file_id', 'email']);
const PHONES = new Set<ProfileField>(['phone', 'home_phone', 'relative_phone']);

/**
 * The applicant's details for university and embassy forms. One row is edited at a time, in place;
 * the server has the last word on each value (and keeps a history of changes).
 */
export function ProfileCard({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const [editing, setEditing] = useState<ProfileField | null>(null);
  const [saved, setSaved] = useState<ProfileField | null>(null);
  // After saving or cancelling, focus goes back to the row's button, not to the top of the page.
  const returnTo = useRef<ProfileField | null>(null);
  useEffect(() => {
    if (editing || !returnTo.current) return;
    document.getElementById(`profile-${returnTo.current}`)?.focus();
    returnTo.current = null;
  }, [editing]);
  const editable = new Set(contract.editable);
  const missing = PROFILE_FIELDS.filter(
    (field) => editable.has(field) && RULES[field] && !contract.profile[field],
  ).length;

  const display = (field: ProfileField, value: string) => {
    if (field === 'birth_date') return f.date(value);
    if (PHONES.has(field)) return formatPhone(value);
    return value;
  };

  return (
    <SectionCard
      id="contract-profile"
      title={t('profile.title')}
      subtitle={t('profile.subtitle')}
      end={missing > 0 && <Chip tone="warn">{t('profile.missing', { n: f.number(missing) })}</Chip>}
    >
      {saved && (
        <div className="px-5 pb-3 lg:px-8">
          <Notice tone="success">
            {t('profile.saved', { field: t(`profile.field.${saved}`) })}
          </Notice>
        </div>
      )}
      <dl className="m-0">
        {PROFILE_FIELDS.map((field) => {
          const value = contract.profile[field];
          const rule = editable.has(field) ? RULES[field] : undefined;
          const label = t(`profile.field.${field}`);
          return (
            <div
              key={field}
              className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 shadow-[inset_0_1px_0_var(--hair)] lg:px-8 lg:py-2.5"
            >
              <dt className="flex-[0_0_100%] text-sm text-text-2 sm:flex-[0_0_220px]">{label}</dt>
              {editing === field && rule ? (
                <dd className="m-0 min-w-0 flex-[1_1_260px]">
                  <EditRow
                    field={field}
                    label={label}
                    rule={rule}
                    initial={value ?? ''}
                    onDone={(done) => {
                      setEditing(null);
                      returnTo.current = field;
                      if (done) setSaved(field);
                    }}
                  />
                </dd>
              ) : (
                <>
                  <dd
                    dir={value && (rule?.ltr ?? LTR_READONLY.has(field)) ? 'ltr' : undefined}
                    className={`m-0 min-w-0 flex-[1_1_200px] text-start text-[15px] font-medium break-words ${
                      value ? 'text-text' : 'text-text-2'
                    } ${value && (rule?.ltr ?? LTR_READONLY.has(field)) ? 'rtl:text-end' : ''}`}
                  >
                    {value ? display(field, value) : t('profile.empty')}
                  </dd>
                  {rule && (
                    <Button
                      id={`profile-${field}`}
                      variant={value ? 'outline' : 'primary'}
                      aria-label={t(value ? 'profile.editLabel' : 'profile.addLabel', {
                        field: label,
                      })}
                      onClick={() => {
                        setSaved(null);
                        setEditing(field);
                      }}
                    >
                      {t(value ? 'profile.edit' : 'profile.add')}
                    </Button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </dl>
    </SectionCard>
  );
}

function EditRow({
  field,
  label,
  rule,
  initial,
  onDone,
}: {
  field: ProfileField;
  label: string;
  rule: FieldRule;
  initial: string;
  onDone: (saved: boolean) => void;
}) {
  const { t } = useTranslation('contract');
  const save = useSaveProfileField();
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<Problem | 'server' | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const result = rule.check(value);
    if ('problem' in result) {
      setProblem(result.problem);
      input.current?.focus();
      return;
    }
    save.mutate(
      { field, value: result.value },
      {
        onSuccess: () => onDone(true),
        onError: () => {
          setProblem('server');
          input.current?.focus();
        },
      },
    );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onDone(false);
  };

  return (
    <form noValidate onSubmit={submit} onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
      <div className="min-w-0 flex-[1_1_200px]">
        <TextField
          ref={input}
          hideLabel
          label={label}
          autoFocus
          dir={rule.ltr ? 'ltr' : 'auto'}
          type={rule.input === 'numeric' ? 'text' : rule.input}
          inputMode={rule.input === 'numeric' ? 'numeric' : undefined}
          autoComplete={rule.autoComplete ?? 'off'}
          value={value}
          error={problem ? t(`profile.error.${problem}`) : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (problem) setProblem(null);
          }}
        />
      </div>
      <div className="flex flex-none gap-2">
        <Button variant="outline" disabled={save.isPending} onClick={() => onDone(false)}>
          {t('profile.cancel')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('profile.saving') : t('profile.save')}
        </Button>
      </div>
    </form>
  );
}
