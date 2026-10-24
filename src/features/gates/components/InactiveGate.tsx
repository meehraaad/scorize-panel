import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SectionCard } from '@/components/ui/SectionCard';
import type { Gates } from '@/lib/applicant/gates';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';

type Inactive = NonNullable<Gates['inactive']>;

/**
 * The contract is over and the panel is closed; the application email logins stay reachable
 * (canvas V6 section 8, inactive panel).
 */
export function InactiveGate({ inactive }: { inactive: Inactive }) {
  const { t } = useTranslation('gates');
  const f = useFormat();

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 lg:gap-7">
      <Card className="flex flex-col gap-3 p-5 lg:p-7">
        <span className="text-[13px] text-text-2">
          {t('inactive.file', { number: f.digits(String(inactive.file_number)) })}
        </span>
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">
          {t('inactive.title')}
        </h1>
        <p className="m-0 text-base leading-8 text-text-2">{t('inactive.text')}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-2">{t('inactive.status')}</span>
          <Chip tone="neutral">{t('inactive.ended')}</Chip>
        </div>
        <p className="m-0 text-sm text-text-2">
          <Trans
            t={t}
            i18nKey="inactive.support"
            values={{ email: inactive.support_email }}
            components={{
              email: (
                <a
                  href={`mailto:${inactive.support_email}`}
                  dir="ltr"
                  className="font-semibold text-primary-text underline underline-offset-4"
                />
              ),
            }}
          />
        </p>
      </Card>

      {inactive.credentials.length > 0 && (
        <SectionCard
          variant="panel"
          id="gate-emails"
          title={t('inactive.emails')}
          subtitle={t('inactive.emailsText')}
        >
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {inactive.credentials.map((item) => (
              <li key={item.label}>
                <Credential {...item} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 lg:p-7">
        <span className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <h2 className="m-0 text-lg font-bold">{t('inactive.next')}</h2>
          <span className="text-[15px] leading-7 text-text-2">{t('inactive.nextText')}</span>
        </span>
        <a href={SITE.consultation} className={buttonClass('primary', 'max-sm:w-full')}>
          {t('inactive.consult')}
        </a>
      </Card>
    </div>
  );
}

function Credential({ label, value, secret }: Inactive['credentials'][number]) {
  const { t } = useTranslation('gates');
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(value)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-canvas px-3.5 py-3">
      <span className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
        <span className="text-xs text-text-2">{label}</span>
        <span dir="ltr" className="text-[15px] font-semibold break-all rtl:text-end">
          {shown ? value : '••••••••'}
        </span>
      </span>
      <span className="flex flex-none gap-2">
        {secret && (
          <Button
            variant="outline"
            className="px-3.5 text-[13px]"
            aria-pressed={shown}
            onClick={() => setShown((value) => !value)}
          >
            {shown ? t('inactive.hide') : t('inactive.show')}
          </Button>
        )}
        <Button
          variant="outline"
          className="px-3.5 text-[13px]"
          aria-label={t('inactive.copy', { name: label })}
          onClick={copy}
        >
          <span aria-live="polite">{copied ? t('inactive.copied') : t('inactive.copyShort')}</span>
        </Button>
      </span>
    </div>
  );
}
