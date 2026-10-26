import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { lockButtonOnHero } from '@/components/ui/Lock';
import {
  ANSWERED_CONTACT_KEY,
  estimateOptionsQuery,
  latestEstimateQuery,
  type EstimateAnswers,
  type EstimateOptions,
  type EstimateResult,
} from '@/lib/applicant/estimate';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { Quiz } from './Quiz';
import { Result, ResultHero } from './Result';

export type EstimateMode = 'quiz' | 'result';

/**
 * The new-user dashboard: the admission-chance quiz, then its result. Someone who took it before
 * sees their last result first and may take it again. The route loads `estimateOptionsQuery` and
 * `latestEstimateQuery` and the `estimate` dictionary.
 */
export function EstimateFlow({
  phone,
  header,
  detailsTo,
  teaser = false,
  sheetOnPhone = false,
}: {
  phone: string | null;
  /** Above the quiz or the result (the estimate page's title). */
  header?: (mode: EstimateMode) => ReactNode;
  /** On the guest home: the result links to the full one instead of showing every country. */
  detailsTo?: string;
  /** First visit on the home: the quiz shows the result's shape, locked, beside the questions. */
  teaser?: boolean;
  /**
   * The home on phones: one short card (start, or the result in brief) and the questions in a
   * bottom sheet, instead of the quiz and its preview filling the page.
   */
  sheetOnPhone?: boolean;
}) {
  const { data: latest } = useSuspenseQuery(latestEstimateQuery);
  const { data: options } = useSuspenseQuery(estimateOptionsQuery);
  // Switched by the quiz finishing, not by the result arriving: the quiz shows its "working it
  // out" card until then.
  const [mode, setMode] = useState<EstimateMode>(latest ? 'result' : 'quiz');
  // Known only after answering in this visit (any page: the home and the full result agree); the
  // result on a later visit doesn't repeat the call promise.
  const client = useQueryClient();
  const [contact, setContact] = useState<EstimateAnswers['contact'] | null>(
    () => client.getQueryData<EstimateAnswers['contact']>(ANSWERED_CONTACT_KEY) ?? null,
  );
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const showResult = mode === 'result' && latest;

  if (sheetOnPhone && !desktop)
    return (
      <CompactEstimate
        latest={latest}
        options={options}
        contact={contact}
        onDone={setContact}
        detailsTo={detailsTo}
      />
    );

  return (
    <>
      {header?.(showResult ? 'result' : 'quiz')}
      {showResult ? (
        <Result
          result={latest}
          contact={contact}
          phone={phone}
          detailsTo={detailsTo}
          onRetake={() => {
            setContact(null);
            client.removeQueries({ queryKey: ANSWERED_CONTACT_KEY });
            setMode('quiz');
          }}
        />
      ) : (
        <Quiz
          options={options}
          teaser={teaser}
          onDone={(answer) => {
            setContact(answer);
            setMode('result');
          }}
        />
      )}
    </>
  );
}

/**
 * On phones: the quiz as one card with a start button (or the result in brief, with a way to answer
 * again); the questions open in a bottom sheet, which closes on the result.
 */
function CompactEstimate({
  latest,
  options,
  contact,
  onDone,
  detailsTo,
}: {
  latest: EstimateResult | null;
  options: EstimateOptions;
  contact: EstimateAnswers['contact'] | null;
  onDone: (contact: EstimateAnswers['contact']) => void;
  detailsTo?: string | undefined;
}) {
  const { t } = useTranslation('estimate');
  const [open, setOpen] = useState(false);
  const best = latest?.countries[0];
  const start = () => setOpen(true);

  return (
    <>
      {latest && best ? (
        <ResultHero result={latest} best={best}>
          {contact && contact.channel !== 'none' && (
            <p className="m-0 flex items-start gap-2 text-sm leading-6 text-on-hero-2">
              <Icon name="check" size={18} className="mt-0.5 flex-none text-live" />
              {t(`result.call.${contact.channel}.${contact.time}`)}
            </p>
          )}
          <div className="flex flex-wrap gap-2 [&>*]:flex-auto">
            {detailsTo && (
              <Link to={detailsTo} className={buttonClass('primary')}>
                {t('result.details')}
              </Link>
            )}
            <Button variant="outline" className={lockButtonOnHero} onClick={start}>
              {t('result.retake')}
            </Button>
          </div>
        </ResultHero>
      ) : (
        <Card aria-labelledby="estimate-start" className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 flex-none items-center justify-center rounded-2xl bg-tint text-primary-text"
            >
              <Icon name="chart" size={20} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="estimate-start" className="m-0 text-base font-bold">
                {t(latest ? 'result.emptyTitle' : 'sheet.title')}
              </h2>
              <p className="m-0 text-sm leading-6 text-text-2">
                {t(latest ? 'result.empty' : 'sheet.text')}
              </p>
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={start}>
            {t(latest ? 'result.retake' : 'sheet.start')}
          </Button>
        </Card>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('title')}
        closeLabel={t('sheet.close')}
      >
        <Quiz
          options={options}
          inSheet
          onDone={(answer) => {
            onDone(answer);
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}
