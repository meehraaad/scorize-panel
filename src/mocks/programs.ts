/** Narrow sample-rule behavior for UI integration tests only; Django evaluates product rules. */
import fixture from './program-entry.json';
import type { DestinationCard } from '@/features/assessments/destinationApi';
import type { Fact } from '@/features/assessments/api';
export const programEntryFixture = () => structuredClone(fixture) as DestinationCard;
export function updateProgramFixture(entry: DestinationCard) {
  const checked = entry.program_result;
  if (!checked) return;
  const value = (key: string) =>
    checked.inputs[key]?.status === 'known' ? checked.inputs[key].value : null;
  const age = value('age'),
    language = value('language'),
    offer = value('offer');
  checked.questions = checked.questions.map((q) => ({
    ...q,
    visibility:
      q.id !== 'offer_type'
        ? 'visible'
        : offer === true
          ? 'visible'
          : offer === false
            ? 'hidden'
            : 'blocked',
  }));
  const adult = typeof age === 'number' ? age >= 18 : null;
  const alternative =
    offer === true || (typeof language === 'number' && language >= 3)
      ? true
      : offer === false && typeof language === 'number'
        ? false
        : null;
  const eligibility =
    adult === false || alternative === false
      ? 'unmet'
      : adult === null || alternative === null
        ? 'insufficient_information'
        : 'met';
  const score =
    offer === false || (typeof age === 'number' && age < 25)
      ? 0
      : offer === true && typeof age === 'number'
        ? 8
        : null;
  checked.result = {
    route_id: entry.id,
    name: 'Synthetic configured program',
    eligibility_status: eligibility,
    score_status: score === null ? 'partial' : 'complete_self_reported',
    score,
    pass_mark_met: score === null ? null : score >= 8,
    requirement_details: [
      {
        id: 'adult',
        label: 'Synthetic minimum',
        status: adult === null ? 'unknown' : adult ? 'met' : 'unmet',
      },
      {
        id: 'alternative',
        label: 'Synthetic alternatives',
        status: alternative === null ? 'unknown' : alternative ? 'met' : 'unmet',
      },
    ],
  };
  checked.next_question =
    eligibility === 'unmet'
      ? null
      : (checked.questions.find((q) => q.id !== 'offer_type' && !checked.inputs[q.id]) ?? null);
}
export function answerProgramFixture(entry: DestinationCard, question: string, fact: Fact) {
  const checked = entry.program_result;
  const definition = checked?.questions.find((q) => q.id === question);
  if (!checked || !definition || definition.visibility !== 'visible') return false;
  if (fact.status === 'known') {
    if (
      definition.kind === 'number' &&
      (typeof fact.value !== 'number' ||
        !Number.isFinite(fact.value) ||
        fact.value < (definition.minimum ?? -Infinity) ||
        fact.value > (definition.maximum ?? Infinity))
    )
      return false;
    if (definition.kind === 'boolean' && typeof fact.value !== 'boolean') return false;
    if (
      definition.kind === 'choice' &&
      (typeof fact.value !== 'string' || !definition.choices?.includes(fact.value))
    )
      return false;
  }
  checked.inputs[question] = fact;
  updateProgramFixture(entry);
  return true;
}
