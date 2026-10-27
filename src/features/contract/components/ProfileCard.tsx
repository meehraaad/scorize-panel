import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { StatusText } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { SideSection } from '@/components/ui/SectionCard';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { formatPhone } from '@/lib/site';
import { toast } from '@/lib/toast';
import { PROFILE_FIELDS, useSaveProfileField, type ContractData, type ProfileField } from '../api';
import { missingDetails, RULES, type FieldRule, type Problem } from './profileRules';

/** Fields shown left to right even though nobody edits them here. */
const LTR_READONLY = new Set<ProfileField>(['file_id', 'email']);
const PHONES = new Set<ProfileField>(['phone', 'home_phone', 'relative_phone']);

/**
 * The applicant's details for university and embassy forms, two columns with thin lines (empty ones
 * in amber, team-set ones with a lock). One row is edited at a time, in place; the server has the
 * last word on each value (and keeps a history of changes).
 */
export function ProfileCard({ contract }: { contract: ContractData }) {
  const { t } = useTranslation('contract');
  const f = useFormat();
  const [editing, setEditing] = useState<ProfileField | null>(null);
  // After saving or cancelling, focus goes back to the row's button, not to the top of the page.
  const returnTo = useRef<ProfileField | null>(null);
  useEffect(() => {
    if (editing || !returnTo.current) return;
    document.getElementById(`profile-${returnTo.current}`)?.focus();
    returnTo.current = null;
  }, [editing]);
  const editable = new Set(contract.editable);
  const missing = missingDetails(contract).length;

  const display = (field: ProfileField, value: string) => {
    if (field === 'birth_date') return f.date(value);
    if (PHONES.has(field)) return formatPhone(value);
    return value;
  };

  return (
    <SideSection
      id="contract-profile"
      title={t('profile.title')}
      subtitle={t('profile.subtitle')}
      end={
        missing > 0 && (
          <StatusText tone="warn">{t('profile.missing', { n: f.number(missing) })}</StatusText>
        )
      }
    >
      <dl className="m-0 grid gap-x-10 lg:grid-cols-2">
        {PROFILE_FIELDS.map((field) => {
          const value = contract.profile[field];
          const rule = editable.has(field) ? RULES[field] : undefined;
          const label = t(`profile.field.${field}`);
          const ltr = Boolean(value) && (rule?.ltr ?? LTR_READONLY.has(field));
          return (
            <div
              key={field}
              className={`flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 py-3 shadow-[inset_0_-1px_0_var(--hair)] ${
                editing === field ? 'lg:col-span-2' : ''
              }`}
            >
              {editing === field && rule ? (
                <>
                  <dt className="flex-[0_0_100%] text-[13px] text-text-2">{label}</dt>
                  <dd className="m-0 min-w-0 flex-1">
                    <EditRow
                      field={field}
                      label={label}
                      rule={rule}
                      initial={value ?? ''}
                      onDone={(done) => {
                        setEditing(null);
                        returnTo.current = field;
                        if (done)
                          toast.success(t('profile.saved', { field: t(`profile.field.${field}`) }));
                      }}
                    />
                  </dd>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <dt className="text-[13px] text-text-2">{label}</dt>
                    <dd
                      dir={ltr ? 'ltr' : undefined}
                      className={`m-0 text-start text-[15px] font-semibold break-words ${
                        value ? 'text-text' : 'text-warn'
                      } ${ltr ? 'rtl:text-end' : ''}`}
                    >
                      {value ? display(field, value) : t('profile.empty')}
                    </dd>
                  </div>
                  {rule ? (
                    <button
                      type="button"
                      id={`profile-${field}`}
                      aria-label={t(value ? 'profile.editLabel' : 'profile.addLabel', {
                        field: label,
                      })}
                      onClick={() => setEditing(field)}
                      className={`inline-flex min-h-11 items-center px-1 text-[13px] text-primary-text ${
                        value ? 'font-semibold' : 'font-bold'
                      }`}
                    >
                      {t(value ? 'profile.edit' : 'profile.add')}
                    </button>
                  ) : (
                    <span className="flex-none text-text-2">
                      <Icon name="lock" size={15} />
                      <span className="sr-only">{t('profile.locked')}</span>
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </dl>
    </SideSection>
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
