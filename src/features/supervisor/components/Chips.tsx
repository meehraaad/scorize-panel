import { useTranslation } from 'react-i18next';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import type { ApplicationResult } from '@/lib/applications';
import type { CaseStage, DocumentState, WritingState } from '../api';

const STAGE_TONE: Record<CaseStage, ChipTone> = {
  documents: 'warn',
  writing: 'info',
  applying: 'primary',
  admitted: 'good',
  visa: 'info',
  on_hold: 'neutral',
  closed: 'neutral',
};

/** Where a case is: "Applying", "Collecting documents". */
export function StageChip({ stage, small = false }: { stage: CaseStage; small?: boolean }) {
  const { t } = useTranslation('supervisor');
  return (
    <Chip tone={STAGE_TONE[stage]} dot small={small}>
      {t(`stage.${stage}`)}
    </Chip>
  );
}

const RESULT_TONE: Record<ApplicationResult, ChipTone> = {
  pending: 'neutral',
  incomplete_documents: 'warn',
  waiting_for_recommendation: 'warn',
  waiting_for_portal: 'warn',
  completed: 'primary',
  submitted: 'info',
  accepted: 'good',
  rejected: 'danger',
};

/** An application's result; "Not sent yet" while it has none. */
export function ResultChip({ result }: { result: ApplicationResult | null }) {
  const { t } = useTranslation('supervisor');
  return (
    <Chip tone={result ? RESULT_TONE[result] : 'neutral'} small>
      {t(result ? `result.${result}` : 'result.none')}
    </Chip>
  );
}

const DOCUMENT_TONE: Record<DocumentState, ChipTone> = {
  missing: 'neutral',
  review: 'warn',
  approved: 'good',
  returned: 'danger',
};

export function DocumentChip({ state }: { state: DocumentState }) {
  const { t } = useTranslation('supervisor');
  return (
    <Chip tone={DOCUMENT_TONE[state]} small dot>
      {t(`documents.state.${state}`)}
    </Chip>
  );
}

/** A writing order's state in a table cell: green when final, amber while open, a dash for none. */
export function WritingCell({ state }: { state: WritingState | null }) {
  const { t } = useTranslation('supervisor');
  if (!state) return <span className="text-text-3">{t('dash')}</span>;
  return (
    <span className={`text-sm font-medium ${state === 'final' ? 'text-good' : 'text-warn'}`}>
      {t(`writingState.${state}`)}
    </span>
  );
}
