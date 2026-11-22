import { useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchSelect, type SearchOption } from '@/components/ui/SearchSelect';
import {
  fieldSearchQuery,
  occupationAnswersQuery,
  occupationSearchQuery,
  type OccupationAnswers,
  suggestedOccupationsQuery,
  type FieldGroup,
  type Occupation,
} from '@/lib/applicant/pathways';
import { useFormat } from '@/lib/i18n/useFormat';
import { searchKey } from '@/lib/text';
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

/** The field groups whose own name has every typed word, on the device (no request). */
function groupsNamed(groups: readonly FieldGroup[], text: string) {
  const words = searchKey(text).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  return groups.filter((group) => {
    const name = searchKey(group.name);
    return words.every((word) => name.includes(word));
  });
}

/**
 * The study field and occupation step, both as searches. The field: typed words match a group's own name at once,
 * and once typing pauses Django also finds the group through its sub-fields ("نرم افزار" → its group), so the
 * answer is always a top group. Then, when a route asks about occupation lists, the occupation: before typing, the
 * field's usual occupations; typed, any other (Persian, English or its code); «don't know» always. Django checks
 * the occupation against each country's list itself.
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
  const [fieldText, setFieldText] = useState('');
  const fieldTyped = useDebouncedValue(fieldText.trim());
  const fieldMatches = useQuery({
    ...fieldSearchQuery(fieldTyped),
    enabled: field === null && fieldTyped.length >= SEARCH_MIN,
  });
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

  // The field: groups named so first (at once), then the ones Django found through a sub-field.
  const fieldOptions: SearchOption[] = groupsNamed(groups, fieldText).map((group) => ({
    value: String(group.id),
    label: group.name,
  }));
  if (fieldText.trim() === fieldTyped)
    for (const match of fieldMatches.data ?? [])
      if (!fieldOptions.some((one) => one.value === String(match.id)))
        fieldOptions.push({
          value: String(match.id),
          label: match.name,
          hint: match.matched
            ? t('asks.field_occupation.field_via', { field: match.matched })
            : undefined,
        });
  const fieldWaiting =
    fieldText.trim() !== fieldTyped || (fieldTyped.length >= SEARCH_MIN && fieldMatches.isFetching);
  const fieldMessage = !fieldText.trim()
    ? undefined
    : fieldOptions.length > 0
      ? undefined
      : fieldWaiting
        ? t('asks.field_occupation.searching')
        : t('asks.field_occupation.field_not_found');
  const fieldName = groups.find((group) => group.id === field)?.name;

  // The occupation: before typing the field's usual ones, typed what matches; «don't know» always last.
  const unsure: SearchOption = {
    value: UNSURE_OCCUPATION,
    label: t('asks.field_occupation.unsure'),
  };
  const listed: Pick<Occupation, 'code' | 'name' | 'name_english'>[] = searching
    ? (found.data ?? [])
    : (suggested.data ?? []);
  const occupationOptions: SearchOption[] = [
    ...listed.map((one) => ({
      value: one.code,
      label: one.name,
      hint: searching
        ? [one.name_english, f.digits(one.code)].filter(Boolean).join(' · ')
        : undefined,
    })),
    unsure,
  ];
  const occupationWaiting = search.trim() !== typed || (searching && found.isFetching);
  const occupationMessage = search.trim()
    ? occupationWaiting && !found.data?.length
      ? t('asks.field_occupation.searching')
      : searching && found.isSuccess && found.data.length === 0
        ? t('asks.field_occupation.not_found')
        : undefined
    : (suggested.data?.length ?? 0) > 0
      ? t('asks.field_occupation.suggested')
      : undefined;
  const occupationValue: SearchOption | null =
    occupation === undefined
      ? null
      : occupation === null
        ? unsure
        : { value: occupation.code, label: occupation.name };
  const pick = (option: SearchOption | null) => {
    if (option === null) setOccupation(undefined);
    else if (option.value === UNSURE_OCCUPATION) setOccupation(null);
    else setOccupation(listed.find((one) => one.code === option.value) ?? occupation);
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
        <SearchSelect
          label={t('asks.field_occupation.field')}
          hint={t('asks.field_occupation.field_hint')}
          value={field !== null && fieldName ? { value: String(field), label: fieldName } : null}
          onChange={(option) => setField(option ? Number(option.value) : null)}
          search={fieldText}
          onSearch={setFieldText}
          options={fieldOptions}
          message={fieldMessage}
          listLabel={t('asks.field_occupation.fields_found')}
          changeLabel={t('asks.field_occupation.change')}
        />
        {askOccupation && (
          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-lead font-semibold">{t('asks.field_occupation.occupation')}</h2>
            <p className="m-0 text-small text-text-2">
              {t('asks.field_occupation.occupation_help')}
            </p>
            <SearchSelect
              label={t('asks.field_occupation.search')}
              placeholder={t('asks.field_occupation.search_hint')}
              value={occupationValue}
              onChange={pick}
              search={search}
              onSearch={setSearch}
              options={occupationOptions}
              message={occupationMessage}
              listLabel={t('asks.field_occupation.found')}
              changeLabel={t('asks.field_occupation.change')}
            />
          </section>
        )}
      </form>
      {actions(ready, formId)}
    </>
  );
}
