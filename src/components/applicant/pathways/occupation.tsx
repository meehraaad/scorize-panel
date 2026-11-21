import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AnswerGroup } from '@/components/ui/AnswerChoices';
import { ChoiceGroup } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import {
  occupationAnswersQuery,
  occupationSearchQuery,
  type OccupationAnswers,
  suggestedOccupationsQuery,
  type FieldGroup,
  type Occupation,
} from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

/** The «don't know / none» answer of the occupation: sent as `occupation: null`. */
export const UNSURE_OCCUPATION = 'unsure';
/** Shorter than this, a search would match too much: wait for more letters. */
const SEARCH_MIN = 2;

/** What the step answered: the field group, and (when asked) the occupation or «don't know». */
export interface FieldOccupation {
  field: number | null;
  /** An occupation, null for «don't know / none», undefined when not picked yet. */
  occupation?: Pick<Occupation, 'code' | 'name'> | null | undefined;
}

/**
 * The study field and occupation step: the field group first (as large answers), then, when a route asks about
 * occupation lists, the occupation: the field's usual occupations as chips first, any other by search (Persian,
 * English or its code), or «don't know». Django checks the occupation against each country's list itself.
 */
export function OccupationAnswer({
  groups,
  askOccupation,
  initial,
  busy,
  onAnswer,
  actions,
}: {
  groups: readonly FieldGroup[];
  askOccupation: boolean;
  /** Picked before going back, else what the profile says. */
  initial: FieldOccupation;
  busy: boolean;
  /** `known`: what Django can answer from the occupation picked (null: nothing, so every question is asked). */
  onAnswer: (answer: FieldOccupation, known: OccupationAnswers | null) => void;
  /** The buttons, around this form's "next" (told whether it can be pressed and the form's id). */
  actions: (ready: boolean, formId: string) => ReactNode;
}) {
  const { t } = useTranslation('pathways');
  const f = useFormat();
  const formId = useId();
  const [field, setField] = useState<number | null>(
    groups.some((group) => group.id === initial.field) ? initial.field : null,
  );
  const [occupation, setOccupation] = useState(initial.occupation);
  const [search, setSearch] = useState('');
  const typed = useDebouncedValue(search.trim());
  const searching = typed.length >= SEARCH_MIN;
  const suggested = useQuery({
    ...suggestedOccupationsQuery(field ?? 0),
    enabled: askOccupation && field !== null,
  });
  const found = useQuery({ ...occupationSearchQuery(typed), enabled: askOccupation && searching });
  // Fetched as soon as one is picked, so "next" knows which list questions Django answers.
  const answers = useQuery({
    ...occupationAnswersQuery(occupation?.code ?? ''),
    enabled: askOccupation && Boolean(occupation),
  });

  // The chips: the occupation picked (if it isn't one of them), the field's usual ones, then «don't know».
  const chips: Pick<Occupation, 'code' | 'name'>[] = [...(suggested.data ?? [])];
  if (occupation && !chips.some((one) => one.code === occupation.code)) chips.unshift(occupation);
  const known = new Map([...chips, ...(found.data ?? [])].map((one) => [one.code, one] as const));
  const value = occupation === null ? UNSURE_OCCUPATION : (occupation?.code ?? null);
  const pick = (code: string) => {
    setOccupation(code === UNSURE_OCCUPATION ? null : (known.get(code) ?? occupation));
    setSearch('');
  };
  const ready =
    field !== null &&
    (!askOccupation || (occupation !== undefined && (!occupation || !answers.isPending)));
  return (
    <>
      <form
        id={formId}
        className="flex flex-col gap-6 lg:gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || !ready) return;
          onAnswer(
            askOccupation ? { field, occupation } : { field },
            occupation ? (answers.data ?? null) : null,
          );
        }}
      >
        <AnswerGroup
          legend={t('asks.field_occupation.field')}
          options={groups.map((group) => ({ value: String(group.id), label: group.name }))}
          value={field === null ? null : String(field)}
          onChange={(id) => setField(Number(id))}
        />
        {askOccupation && (
          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-lead font-semibold">{t('asks.field_occupation.occupation')}</h2>
            <p className="m-0 text-small text-text-2">
              {t('asks.field_occupation.occupation_help')}
            </p>
            <ChoiceGroup
              legend={t('asks.field_occupation.suggested')}
              hideLegend
              look="chips"
              options={[
                ...chips.map((one) => ({ value: one.code, label: one.name })),
                { value: UNSURE_OCCUPATION, label: t('asks.field_occupation.unsure') },
              ]}
              value={value}
              onChange={pick}
            />
            <TextField
              label={t('asks.field_occupation.search')}
              placeholder={t('asks.field_occupation.search_hint')}
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
            />
            {searching && (found.data?.length ?? 0) > 0 && (
              <ChoiceGroup
                legend={t('asks.field_occupation.found')}
                hideLegend
                look="tiles"
                options={(found.data ?? []).map((one) => ({
                  value: one.code,
                  label: one.name,
                  hint: [one.name_english, f.digits(one.code)].filter(Boolean).join(' · '),
                }))}
                value={value}
                onChange={pick}
              />
            )}
            {searching && found.isSuccess && found.data.length === 0 && (
              <p className="m-0 text-sm text-text-2">{t('asks.field_occupation.not_found')}</p>
            )}
          </section>
        )}
      </form>
      {actions(ready, formId)}
    </>
  );
}
