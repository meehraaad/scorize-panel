import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { REFERRALS, useUpdateAccount, type Referral } from '@/lib/account/api';

/** "How did you hear about us": asked once, then replaced by a thank-you. */
export function ReferralCard() {
  const { t } = useTranslation('account');
  const update = useUpdateAccount();
  const [picked, setPicked] = useState<Referral | null>(null);
  const [problem, setProblem] = useState(false);

  if (update.isSuccess)
    return (
      <SectionCard variant="panel" id="account-referral" title={t('referral.title')}>
        <Notice tone="success">{t('referral.thanks')}</Notice>
      </SectionCard>
    );

  return (
    <SectionCard variant="panel" id="account-referral" title={t('referral.title')}>
      <div role="group" aria-labelledby="account-referral" className="flex flex-wrap gap-2">
        {REFERRALS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={picked === item}
            onClick={() => {
              setProblem(false);
              setPicked(item);
            }}
            className={`min-h-11 rounded-full px-4 text-sm ${
              picked === item
                ? 'bg-tint text-primary-text shadow-[inset_0_0_0_1.5px_var(--primary)]'
                : 'text-text shadow-[inset_0_0_0_1px_var(--line-2)]'
            }`}
          >
            {t(`referral.${item}`)}
          </button>
        ))}
      </div>
      {problem && <Notice tone="error">{t('referral.pickFirst')}</Notice>}
      <Button
        className="self-start"
        disabled={update.isPending}
        onClick={() => (picked ? update.mutate({ referral: picked }) : setProblem(true))}
      >
        {t('referral.submit')}
      </Button>
    </SectionCard>
  );
}
