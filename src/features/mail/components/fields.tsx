import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { IconButton } from '@/components/ui/IconButton';
import { TextField } from '@/components/ui/TextField';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { applicantSearchQuery, type MailboxApplicant } from '../api';
import { useSize } from '../format';

const QUOTAS_MB = [512, 1024, 2048, 5120, 10240];

/**
 * A mailbox's quota as a select: the usual sizes, the current one if it is another, none, and
 * (for a new mailbox) the server's default. Values: MB as text, `none`, `default`.
 */
export function QuotaField({
  value,
  onChange,
  current,
  defaultMb,
}: {
  value: string;
  onChange: (value: string) => void;
  /** The mailbox's quota now (kept as an option when it isn't a usual size). */
  current?: number | null;
  /** Offers "the server's default" (a new mailbox). */
  defaultMb?: number;
}) {
  const { t } = useTranslation('mail');
  const size = useSize();
  const sizes = [...QUOTAS_MB];
  if (current && !sizes.includes(current)) sizes.push(current);
  sizes.sort((a, b) => a - b);
  return (
    <SelectField
      label={t('quota.label')}
      hint={t('quota.hint')}
      value={value}
      onChange={onChange}
      options={[
        ...(defaultMb === undefined
          ? []
          : [{ value: 'default', label: t('quota.default', { size: size(defaultMb) }) }]),
        ...sizes.map((mb) => ({ value: String(mb), label: size(mb) })),
        { value: 'none', label: t('quota.none') },
      ]}
    />
  );
}

/** Finds an applicant by name or file number; shows the chosen one with a way to change it. */
export function ApplicantPicker({
  value,
  onChange,
  error,
}: {
  value: MailboxApplicant | null;
  onChange: (applicant: MailboxApplicant | null) => void;
  error?: string | undefined;
}) {
  const { t } = useTranslation('mail');
  const f = useFormat();
  const [text, setText] = useState('');
  const typed = text.trim();
  const searched = useDebouncedValue(typed);
  const { data: found, isFetching } = useQuery(applicantSearchQuery(searched));
  const file = (n: number | null) => (n === null ? t('dash') : f.number(n));

  if (value)
    return (
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-medium">{t('applicant.label')}</span>
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-canvas px-4 py-2">
          <span className="text-[15px]">
            {t('applicant.chosen', { name: value.name, file: file(value.file_number) })}
          </span>
          <IconButton
            icon="close"
            tone="muted"
            aria-label={t('applicant.clear')}
            onClick={() => onChange(null)}
          />
        </div>
        {error && <p className="m-0 text-sm text-danger">{error}</p>}
      </div>
    );

  const matches = typed && searched === typed ? (found ?? []) : [];
  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t('applicant.search')}
        placeholder={t('applicant.placeholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={error}
        autoComplete="off"
      />
      {matches.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {matches.map((match) => (
            <li key={match.id}>
              <Button
                variant="outline"
                className="h-auto min-h-11 w-full flex-col items-start gap-0.5 py-2 text-start"
                onClick={() => {
                  onChange(match);
                  setText('');
                }}
              >
                <span>
                  {t('applicant.option', { name: match.name, file: file(match.file_number) })}
                </span>
                {match.emails.length > 0 && (
                  <span className="text-[13px] font-normal text-text-2">
                    <bdi>{t('applicant.has', { emails: match.emails.join('، ') })}</bdi>
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        typed &&
        searched === typed &&
        found &&
        !isFetching && <p className="m-0 text-sm text-text-2">{t('applicant.noMatch')}</p>
      )}
    </div>
  );
}

/** A password answered once: shown with a copy button and the warning that it won't be again. */
export function PasswordReveal({ password }: { password: string }) {
  const { t } = useTranslation('mail');
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-warn-tint p-4">
      <p className="m-0 text-sm leading-7 text-warn">{t('password.once')}</p>
      <div className="flex items-center gap-2">
        <code
          dir="ltr"
          className="min-w-0 flex-1 truncate rounded-xl bg-surface px-3 py-2 text-base"
        >
          {password}
        </code>
        <IconButton
          icon={copied ? 'check' : 'document'}
          tone="muted"
          aria-label={t('password.copy')}
          onClick={() => {
            void navigator.clipboard
              .writeText(password)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {copied ? t('password.copied') : ''}
      </p>
    </div>
  );
}
