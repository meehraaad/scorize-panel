import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { StepBar } from '@/components/ui/Progress';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { turkeyQuery, type TurkeyStep } from './api';
import { DocsStep } from './components/DocsStep';
import { DoneStep } from './components/DoneStep';
import { SignStep } from './components/SignStep';
import { StartStep } from './components/StartStep';

const BAR = ['docs', 'review', 'sign', 'start'] as const;
/** Each request step on the four-part bar (answers and uploads are one part). */
const BAR_INDEX: Record<TurkeyStep, number> = { start: 0, docs: 0, review: 1, sign: 2, done: 3 };

/**
 * The free Turkey application, one page whose body follows the request's step: questions,
 * documents (and their review), the pledge with an SMS code, then the started case.
 * Design: canvas V7 section 3 (AppTurkey: start, docs, review, sign, done).
 */
export default function TurkeyPage() {
  const { t } = useTranslation('turkey');
  const { data } = useSuspenseQuery(turkeyQuery);
  useDocumentTitle(t('title'));

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 lg:gap-7">
      <div className="flex flex-col gap-4 rounded-card-sm bg-surface p-5 shadow-panel lg:rounded-card lg:px-7">
        <span className="flex items-center gap-2.5 text-[15px] font-bold">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-xl bg-tint text-xs font-extrabold tracking-wider text-primary-text"
          >
            {t('badge')}
          </span>
          {t('title')}
        </span>
        <StepBar
          label={t('steps')}
          steps={BAR.map((key) => ({ key, label: t(`step.${key}`) }))}
          current={BAR_INDEX[data.step]}
          finished={data.step === 'done'}
        />
      </div>

      {data.step === 'start' && <StartStep />}
      {(data.step === 'docs' || data.step === 'review') && <DocsStep data={data} />}
      {data.step === 'sign' && data.pledge && <SignStep data={data} pledge={data.pledge} />}
      {data.step === 'done' && <DoneStep />}
    </div>
  );
}
