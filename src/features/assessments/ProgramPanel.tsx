import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import { Notice } from '@/components/ui/Notice';
import { safeHref } from '@/lib/url';
import { sameAnswerContent } from './answerEquality';
import type { DestinationCard } from './destinationApi';
import type { ProgramInteraction } from './programTypes';
import type { Fact } from './api';

export function ProgramPanel({
  entry,
  interaction,
}: {
  entry: DestinationCard;
  interaction?: ProgramInteraction | undefined;
}) {
  const { t, i18n } = useTranslation('assessments');
  const checked = entry.program_result;
  if (!checked) return null;
  const draft = interaction?.drafts[entry.id] ?? {};
  const dirty = Object.entries(draft).some(
    ([id, fact]) => !sameAnswerContent(fact, checked.inputs[id]),
  );
  const otherDirty =
    interaction &&
    Object.entries(interaction.drafts).some(
      ([id, facts]) => id !== entry.id && Object.keys(facts).length > 0,
    );
  const disabled = Boolean(interaction?.disabled || otherDirty);
  const reasonWords = t('programs.reasons', { returnObjects: true }) as Record<string, string>;
  const questionText = (q: { text: string; translations?: Partial<Record<'fa' | 'en', string>> }) =>
    q.translations?.[i18n.language === 'fa' ? 'fa' : 'en'] || q.text;
  const shownValue = (value: Fact['value']) =>
    typeof value === 'boolean' ? t(value ? 'yes' : 'no') : (value ?? t('calculator.unknown'));
  return (
    <section
      id={`program-${entry.id}`}
      aria-label={t('programs.checkTitle', {
        title: entry.title[i18n.language === 'fa' ? 'fa' : 'en'],
      })}
      className="my-3 flex min-w-0 flex-col gap-4"
    >
      <h4 className="font-bold">{t('programs.checkHeading')}</h4>
      <Notice tone="info">{t('programs.meaning')}</Notice>
      {checked.reason && (
        <Notice tone="warn">{reasonWords[checked.reason] ?? t('calculator.unknown')}</Notice>
      )}
      {checked.result && (
        <>
          <p>
            {t('programs.conditions')}:{' '}
            {t(`programs.conditionsStatus.${checked.result.eligibility_status}`)}
          </p>
          <ul className="list-inside list-disc">
            {checked.result.requirement_details.map((row) => (
              <li key={row.id}>
                {row.label}: {t(`programs.requirementStatus.${row.status}`)}
              </li>
            ))}
          </ul>
          <p>
            {t('programs.points', {
              score: checked.result.score ?? t('calculator.partial'),
              status: t(
                checked.result.score_status === 'not_applicable'
                  ? 'programs.noScore'
                  : checked.result.score_status === 'partial'
                    ? 'programs.partialScore'
                    : 'programs.completeScore',
              ),
            })}
          </p>
          {checked.result.pass_mark_met !== null && (
            <p>
              {t('programs.passMark')}: {t(checked.result.pass_mark_met ? 'yes' : 'no')}
            </p>
          )}
        </>
      )}
      {checked.next_question && (
        <p className="font-semibold">
          {t('programs.next', { question: questionText(checked.next_question) })}
        </p>
      )}
      {dirty && interaction && (
        <>
          <Notice tone="warn">{t('calculator.unsaved')}</Notice>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => interaction.onChange(entry.id, {})}
          >
            {t('programs.discard')}
          </Button>
        </>
      )}
      {interaction && checked.definition_changed && (
        <Button
          variant="outline"
          disabled={disabled || dirty}
          onClick={() =>
            interaction.onSend('program_adopt', {
              entry_id: entry.id,
              program_sha256: checked.program_sha256,
            })
          }
        >
          {t('programs.adopt')}
        </Button>
      )}
      {checked.questions
        .filter((q) => q.visibility !== 'hidden')
        .map((question) => {
          const fact = draft[question.id] ??
            checked.inputs[question.id] ?? { status: 'unknown' as const, value: null };
          const set = (next: Fact) =>
            interaction?.onChange(entry.id, { ...draft, [question.id]: next });
          const label = questionText(question);
          return (
            <div
              key={question.id}
              className="border-line flex min-w-0 flex-col gap-3 border-t pt-3"
            >
              <p className="font-semibold">{label}</p>
              {question.help && <p>{question.help}</p>}
              {question.visibility === 'blocked' && <p>{t('programs.parentRequired')}</p>}
              {!interaction ? (
                <p>
                  {t(`calculator.choices.${fact.status}`)}: {shownValue(fact.value)}
                </p>
              ) : (
                <fieldset
                  disabled={
                    disabled || Boolean(checked.reason) || question.visibility !== 'visible'
                  }
                  className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0"
                >
                  <SelectField
                    label={t('programs.answerStatus', { question: label })}
                    value={fact.status}
                    options={(
                      ['known', 'unknown', 'needs_confirmation', 'not_applicable'] as const
                    ).map((value) => ({ value, label: t(`calculator.choices.${value}`) }))}
                    onChange={(status) =>
                      set({ status, value: status === 'known' ? fact.value : null })
                    }
                  />
                  {fact.status === 'known' &&
                    (question.kind === 'number' ? (
                      <TextField
                        type="number"
                        label={label}
                        min={question.minimum}
                        max={question.maximum}
                        value={fact.value === null ? '' : String(fact.value)}
                        onChange={(event) =>
                          set({
                            ...fact,
                            value: event.target.value,
                          })
                        }
                      />
                    ) : (
                      <SelectField
                        label={label}
                        value={fact.value === null ? '' : String(fact.value)}
                        options={[
                          { value: '', label: t('calculator.choose') },
                          ...(question.kind === 'boolean'
                            ? [
                                { value: 'true', label: t('yes') },
                                { value: 'false', label: t('no') },
                              ]
                            : (question.choices ?? []).map((value) => ({ value, label: value }))),
                        ]}
                        onChange={(value) =>
                          set({
                            ...fact,
                            value:
                              value === ''
                                ? null
                                : question.kind === 'boolean'
                                  ? value === 'true'
                                  : value,
                          })
                        }
                      />
                    ))}
                  {fact.status === 'needs_confirmation' &&
                    checked.inputs[question.id]?.previous_answer && (
                      <p>
                        {t('programs.previous', {
                          value: shownValue(
                            checked.inputs[question.id]?.previous_answer?.value ?? null,
                          ),
                        })}
                      </p>
                    )}
                  <Button
                    disabled={
                      !draft[question.id] ||
                      sameAnswerContent(draft[question.id], checked.inputs[question.id])
                    }
                    onClick={() =>
                      interaction.onSend('program_answer', {
                        entry_id: entry.id,
                        program_sha256: checked.program_sha256,
                        question_id: question.id,
                        status: fact.status,
                        value:
                          fact.status === 'known'
                            ? question.kind === 'number' && typeof fact.value === 'string'
                              ? fact.value.trim() === ''
                                ? null
                                : Number(fact.value)
                              : fact.value
                            : null,
                      })
                    }
                  >
                    {t('programs.saveAnswer', { question: label })}
                  </Button>
                </fieldset>
              )}
            </div>
          );
        })}
      <a className="underline" href={safeHref(checked.source.url)}>
        {checked.source.title}
      </a>
      <p className="text-sm text-text-2">
        {t('programs.sourceDates', {
          checked: checked.source.checked_on,
          due: checked.source.review_due,
          received: checked.source.received_at,
          effective: checked.source.effective_on,
          from: checked.coverage.from,
          through: checked.coverage.through,
        })}
      </p>
    </section>
  );
}
