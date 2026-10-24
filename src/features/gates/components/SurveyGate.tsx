import { useState, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { useFormat } from '@/lib/i18n/useFormat';
import {
  SURVEY_ANSWERS,
  useAnswerSurvey,
  type Gates,
  type SurveyAnswer,
} from '@/lib/applicant/gates';
import { toast } from '@/lib/toast';

/**
 * Monthly supervisor surveys that must be answered before the panel opens (canvas V6 section 8).
 * One at a time; the server drops each one as it is answered.
 */
export function SurveyGate({ surveys }: { surveys: Gates['surveys'] }) {
  const { t } = useTranslation('gates');
  const f = useFormat();
  // How many there were when the page opened, for "survey 2 of 2".
  const [total] = useState(surveys.length);
  const current = surveys[0];
  if (!current) return null;
  const position = total - surveys.length + 1;

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 lg:gap-7">
      <div className="flex flex-col gap-2.5">
        <h1 className="m-0 font-display text-2xl leading-snug font-bold lg:text-[32px]">
          {t('survey.title')}
        </h1>
        <p className="m-0 text-base leading-8 text-text-2">
          {t('survey.text', { n: f.number(total) })}
        </p>
      </div>
      <SurveyForm
        key={current.id}
        survey={current}
        label={t('survey.which', { n: f.number(position), total: f.number(total) })}
      />
    </div>
  );
}

function SurveyForm({ survey, label }: { survey: Gates['surveys'][number]; label: string }) {
  const { t } = useTranslation('gates');
  const answer = useAnswerSurvey();
  const [picked, setPicked] = useState<SurveyAnswer | null>(null);
  const [missing, setMissing] = useState(false);

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (!picked) {
      setMissing(true);
      return;
    }
    answer.mutate(
      { id: survey.id, answer: picked },
      { onError: () => toast.error(t('survey.error')) },
    );
  };

  return (
    <Card className="p-5 lg:p-7">
      <form noValidate onSubmit={submit} aria-label={label} className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Avatar name={survey.supervisor} />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] text-text-2">{label}</span>
            <span className="text-base font-bold">{survey.supervisor}</span>
          </span>
        </div>
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="pb-3 text-[15px] font-semibold">
            {t('survey.question', { name: survey.supervisor })}
          </legend>
          <div className="grid gap-2 sm:grid-cols-4">
            {SURVEY_ANSWERS.map((item) => (
              <label
                key={item}
                className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl px-4 text-[15px] shadow-[inset_0_0_0_1px_var(--line-2)] has-checked:bg-tint has-checked:text-primary-text has-checked:shadow-[inset_0_0_0_1.5px_var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-focus"
              >
                <input
                  type="radio"
                  name={`survey-${String(survey.id)}`}
                  checked={picked === item}
                  onChange={() => {
                    setPicked(item);
                    setMissing(false);
                  }}
                  className="accent-primary"
                />
                {t(`survey.answer.${item}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {missing && <Notice tone="error">{t('survey.pickFirst')}</Notice>}
        <Button type="submit" disabled={answer.isPending} className="sm:self-start">
          {answer.isPending ? t('survey.sending') : t('survey.submit')}
        </Button>
      </form>
    </Card>
  );
}
