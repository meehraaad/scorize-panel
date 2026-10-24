import { useSuspenseQuery } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SectionCard } from '@/components/ui/SectionCard';
import { TextAreaField } from '@/components/ui/TextField';
import { gatesQuery, useAnswerNps } from '@/lib/applicant/gates';
import { useFormat } from '@/lib/i18n/useFormat';
import { toast } from '@/lib/toast';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * The optional NPS survey on the home page, when the server says it is due (canvas V6 section 14).
 * Answering adds credit; "later" hides it until the server asks again.
 */
export function NpsCard() {
  const { t } = useTranslation('gates');
  const f = useFormat();
  const { data } = useSuspenseQuery(gatesQuery);
  // Kept from the first render: the refetch after answering drops `nps`, the thanks stays.
  const [credit] = useState(data.nps?.credit ?? null);
  const answer = useAnswerNps();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<'open' | 'thanks' | 'hidden'>('open');

  if (credit === null || state === 'hidden') return null;
  const amount = f.number(credit);

  if (state === 'thanks')
    return (
      <SectionCard variant="panel" id="nps" title={t('nps.title')}>
        <Notice tone="success">{t('nps.thanks', { amount })}</Notice>
      </SectionCard>
    );

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (score === null) {
      setMissing(true);
      return;
    }
    answer.mutate(
      { score, comment: comment.trim() },
      { onError: () => toast.error(t('nps.error')), onSuccess: () => setState('thanks') },
    );
  };

  const later = () => {
    answer.mutate({ dismissed: true }, { onError: () => toast.error(t('nps.error')) });
    setState('hidden');
  };

  return (
    <SectionCard
      variant="panel"
      id="nps"
      title={t('nps.title')}
      subtitle={t('nps.text', { amount })}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="pb-3 text-[15px] font-semibold">{t('nps.question')}</legend>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
            {SCORES.map((value) => (
              <label
                key={value}
                className="flex h-11 cursor-pointer items-center justify-center rounded-xl text-[15px] font-semibold tabular-nums shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-primary has-checked:text-on-primary has-checked:shadow-none has-focus-visible:outline-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name="nps-score"
                  value={value}
                  checked={score === value}
                  onChange={() => {
                    setScore(value);
                    setMissing(false);
                  }}
                  className="sr-only"
                />
                {f.number(value)}
              </label>
            ))}
          </div>
          <div aria-hidden="true" className="flex justify-between text-xs text-text-2">
            <span>{t('nps.low')}</span>
            <span>{t('nps.high')}</span>
          </div>
        </fieldset>
        <TextAreaField
          label={t('nps.comment')}
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        {missing && <Notice tone="error">{t('nps.pickFirst')}</Notice>}
        <div className="flex flex-wrap gap-2.5">
          <Button type="submit" disabled={answer.isPending} className="max-sm:flex-1">
            {answer.isPending ? t('nps.sending') : t('nps.submit')}
          </Button>
          <Button variant="outline" onClick={later} className="max-sm:flex-1">
            {t('nps.later')}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
