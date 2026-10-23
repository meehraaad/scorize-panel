import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useFormat } from '@/lib/i18n/useFormat';
import { SITE } from '@/lib/site';

/** "Change number" / "Change email" above a step's title. */
export function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-text-2 hover:text-text"
    >
      <Icon name="chevronStart" size={16} />
      {children}
    </button>
  );
}

/** Sign-up progress: step `current` of 2 (details, then the SMS code). */
export function SignupProgress({ current }: { current: 1 | 2 }) {
  const { t } = useTranslation('auth');
  const format = useFormat();
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-text-2">
      {[1, 2].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={`h-1 w-6 rounded-sm ${n <= current ? 'bg-primary' : 'bg-line-2'}`}
        />
      ))}
      {t('register.progress', { current: format.number(current), total: format.number(2) })}
    </span>
  );
}

/** Tinted note under a form: privacy promise, "never share this code", … */
export function StepNote({
  icon,
  tone,
  children,
}: {
  icon: IconName;
  tone: 'good' | 'warn';
  children: ReactNode;
}) {
  const tile = tone === 'good' ? 'bg-good-tint text-good' : 'text-warn';
  return (
    <div
      className={`flex items-start gap-3 rounded-[20px] px-[18px] py-4 ${tone === 'good' ? 'bg-surface shadow-panel' : 'bg-warn-tint'}`}
    >
      <span className={`flex size-9 flex-none items-center justify-center rounded-xl ${tile}`}>
        <Icon name={icon} size={18} />
      </span>
      <p className={`m-0 text-sm leading-[1.8] ${tone === 'good' ? 'text-neutral' : 'text-warn'}`}>
        {children}
      </p>
    </div>
  );
}

/** "By continuing you accept Scorize's terms." `i18nKey` holds a <terms> tag around the link text. */
export function TermsNote({ i18nKey }: { i18nKey: 'identify.terms' | 'register.terms' }) {
  return (
    <p className="m-0 text-[13px] leading-[1.8] text-text-2">
      <Trans
        ns="auth"
        i18nKey={i18nKey}
        components={{
          terms: (
            // Trans puts the link text inside.
            <a
              href={SITE.terms}
              target="_blank"
              rel="noopener"
              className="text-primary-text hover:underline"
            />
          ),
        }}
      />
    </p>
  );
}

/** A phone number or email inside a sentence: kept left-to-right and emphasised. */
export function Identifier({ children }: { children?: ReactNode }) {
  return (
    <span dir="ltr" className="font-semibold text-text">
      {children}
    </span>
  );
}
