import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  ANSWERED_CONTACT_KEY,
  estimateOptionsQuery,
  latestEstimateQuery,
  type EstimateAnswers,
} from '@/lib/applicant/estimate';
import { DESKTOP_QUERY, useMediaQuery } from '@/lib/useMediaQuery';
import { CompactEstimate } from './CompactEstimate';
import { Quiz } from './Quiz';
import { Result } from './Result';

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
  sheetOnPhone = false,
}: {
  phone: string | null;
  /** Above the quiz or the result (the estimate page's title). */
  header?: (mode: EstimateMode) => ReactNode;
  /** On the guest home: the result links to the full one instead of showing every country. */
  detailsTo?: string;
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
          onDone={(answer) => {
            setContact(answer);
            setMode('result');
          }}
        />
      )}
    </>
  );
}
