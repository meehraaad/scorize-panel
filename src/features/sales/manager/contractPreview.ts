import type { BuilderClause, ContractBuilder, ContractDocument } from '../api';
import { suggestedSchedule } from '../plan';

/** A clause the manager is writing or changing, before it is saved: `id` null for a new one. */
export interface ClauseDraft {
  id: number | null;
  title: string;
  text: string;
}

/** Instalments shown in the sample: the offer's usual three, if the rules allow as many. */
const SAMPLE_INSTALMENTS = 3;
/** Applies in the sample, if the rules allow as many. */
const SAMPLE_APPLIES = 6;
/** Master's (Django's `Degree.MASTERS`): the degree most contracts are for. */
const SAMPLE_DEGREE = 2;

const isoDate = (date: Date) =>
  `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * The clauses as the sheet should show them: the active ones with the clause being written in
 * place (or added at the end), and which one that is (`highlight`), so the preview follows the
 * typing before anything is saved.
 */
export function previewClauses(
  active: BuilderClause[],
  draft: ClauseDraft | null,
  newTitle: string,
): { clauses: { title: string; text: string }[]; highlight: number | null } {
  const clauses = active.map((clause) =>
    draft && clause.id === draft.id
      ? { title: draft.title.trim() || clause.title, text: draft.text }
      : { title: clause.title, text: clause.text },
  );
  if (draft?.id === null) {
    clauses.push({ title: draft.title.trim() || newTitle, text: draft.text });
    return { clauses, highlight: clauses.length - 1 };
  }
  const index = draft ? active.findIndex((clause) => clause.id === draft.id) : -1;
  return { clauses, highlight: index === -1 ? null : index };
}

/**
 * A sample customer's contract of this kind (S68), as the printed contract lays it out: the
 * services this kind offers at their prices, the rules' usual duration, and instalments the way a
 * seller's offer starts them (none when it is free). Only the clauses are real; the rest shows the
 * shape of the page.
 */
export function sampleDocument(
  builder: ContractBuilder,
  clauses: { title: string; text: string }[],
  customer: string,
  today: Date = new Date(),
): ContractDocument {
  const offered = builder.prices.filter((row) => row.is_active && row.price !== null);
  const amount = offered.reduce((sum, row) => sum + (row.price ?? 0), 0);
  const { durations, max_applies: maxApplies, max_instalments: maxInstalments } = builder.rules;
  const months = durations.includes(12) ? 12 : (durations[0] ?? 12);
  const start = isoDate(today);
  const end = isoDate(new Date(today.getFullYear(), today.getMonth() + months, today.getDate()));
  const schedule =
    amount === 0
      ? []
      : suggestedSchedule(amount, Math.min(SAMPLE_INSTALMENTS, maxInstalments), start);
  return {
    number: null,
    file_id: null,
    approved_at: null,
    draft: true,
    template: builder.template.id === null ? '' : builder.template.name,
    customer: { name: customer, national_code: null, phone: null, email: '' },
    seller: '',
    features: offered.map((row) => row.feature),
    degrees: [SAMPLE_DEGREE],
    countries: [],
    applies: Math.min(SAMPLE_APPLIES, maxApplies),
    start_date: start,
    end_date: end,
    months,
    language_score: '',
    language_deadline: null,
    amount,
    installments: schedule.map((row, index) => ({
      id: index,
      number: index,
      amount: row.amount,
      due_date: row.date,
      condition: null,
    })),
    clauses,
    agreement: null,
  };
}
