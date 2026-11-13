import type { Bundle, Expected, Fact, Question, Evaluation } from './api';
export interface ProgramDefinition {
  schema_version: 1;
  bundle: Pick<Bundle, 'schema_version' | 'synthetic' | 'questions' | 'routes'>;
  source: {
    title: string;
    url: string;
    checked_on: string;
    review_due: string;
    received_at: string;
    effective_on: string;
    status: 'draft' | 'reviewed_program';
  };
  coverage: { from: string; through: string };
}
export interface ProgramCase {
  answers: Record<string, Fact>;
  expected: Omit<Expected, 'route_id'>;
}
export interface ProgramResult {
  version: string;
  program_sha256: string;
  definition_changed: boolean;
  status: string;
  reason: string | null;
  inputs: Record<string, Fact & { previous_answer?: Fact }>;
  questions: (Question & { visibility: 'visible' | 'hidden' | 'blocked' })[];
  result: Evaluation['results'][number] | null;
  next_question: Question | null;
  source: ProgramDefinition['source'];
  coverage: ProgramDefinition['coverage'];
  assessment_date: string;
}
export interface ProgramInteraction {
  drafts: Record<string, Record<string, Fact>>;
  disabled: boolean;
  onChange: (id: string, facts: Record<string, Fact>) => void;
  onSend: (action: 'program_adopt' | 'program_answer', body: Record<string, unknown>) => void;
}
