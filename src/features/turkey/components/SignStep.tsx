import { useTranslation } from 'react-i18next';
import { PledgeForm } from '@/components/applicant/PledgeForm';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import type { TurkeyCase } from '@/lib/applicant/turkey';

const FACTS = ['country', 'services', 'fee', 'duty'] as const;

/**
 * Step 4: the pledge. Read it, then sign it with an SMS code (PledgeForm).
 */
export function SignStep({
  data,
  pledge,
}: {
  data: TurkeyCase;
  pledge: NonNullable<TurkeyCase['pledge']>;
}) {
  const { t } = useTranslation('turkey');
  return (
    <>
      <div className="flex flex-col items-start gap-2.5">
        <Chip tone="good" dot>
          {t('sign.approved')}
        </Chip>
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">
          {t('sign.title')}
        </h1>
        <p className="m-0 text-base leading-8 text-text-2">{t('sign.text')}</p>
      </div>

      <Card aria-label={t('sign.summary')} className="p-5 lg:px-7">
        <dl className="m-0 grid gap-4 sm:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact} className="flex flex-col gap-1">
              <dt className="text-[13px] text-text-2">{t(`sign.fact.${fact}.label`)}</dt>
              <dd className={`m-0 text-[15px] font-semibold ${fact === 'fee' ? 'text-good' : ''}`}>
                {t(`sign.fact.${fact}.value`)}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col">
        <div
          // A scroll box keyboard users can scroll too.
          tabIndex={0}
          role="region"
          aria-label={t('sign.textLabel')}
          className="flex max-h-[360px] flex-col gap-5 overflow-y-auto p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus lg:px-7"
        >
          {pledge.clauses.map((clause) => (
            <div key={clause.title} className="flex flex-col gap-1.5">
              <h2 className="m-0 text-base font-bold">{clause.title}</h2>
              <p className="m-0 text-[15px] leading-8 whitespace-pre-line text-text-2">
                {clause.text}
              </p>
            </div>
          ))}
        </div>

        <PledgeForm
          data={data}
          pledge={pledge}
          className="p-5 shadow-[inset_0_1px_0_var(--hair)] lg:px-7"
        />
      </Card>
    </>
  );
}
