import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import { BundleDefinitionEditor } from './BundleDefinitionEditor';
import { ValueField } from './RuleEditor';
import type { DestinationEntry } from './destinationApi';
import type { ProgramDefinition, ProgramCase } from './programTypes';
import { blankProgram } from './programDefinition';
import { blankExpected, valueOf } from './rules';

const PROGRAM_SOURCE_FIELDS = [
  'title',
  'url',
  'checked_on',
  'review_due',
  'received_at',
  'effective_on',
] as const;
const PROGRAM_FACT_STATES = [
  'not_supplied',
  'known',
  'unknown',
  'needs_confirmation',
  'not_applicable',
] as const;
const PROGRAM_COVERAGE_FIELDS = ['from', 'through'] as const;
export function ProgramEditor({
  entry,
  onChange,
}: {
  entry: DestinationEntry;
  onChange: (program: ProgramDefinition | null) => void;
}) {
  const { t } = useTranslation('assessments');
  const program = entry.program;
  if (!program)
    return (
      <Button
        variant="outline"
        disabled={Boolean(entry.calculator_route)}
        onClick={() => onChange(blankProgram(entry, t('programs.syntheticQuestion')))}
      >
        {t('programs.addDefinition')}
      </Button>
    );
  return (
    <details className="flex min-w-0 flex-col gap-4" open>
      <summary className="min-h-11 cursor-pointer py-2">{t('programs.definition')}</summary>
      <p>{t('programs.editorMeaning')}</p>
      <BundleDefinitionEditor
        singleRoute
        input={{ key: 'program', title: '', bundle: program.bundle, scenarios: [], sources: [] }}
        onChange={(next) => onChange({ ...program, bundle: next.bundle })}
      />
      <h4>{t('programs.source')}</h4>
      {PROGRAM_SOURCE_FIELDS.map((key) => (
        <TextField
          key={key}
          label={t(`programs.sourceFields.${key}`)}
          value={program.source[key]}
          type={
            key === 'checked_on' || key === 'review_due' || key === 'effective_on' ? 'date' : 'text'
          }
          onChange={(event) =>
            onChange({ ...program, source: { ...program.source, [key]: event.target.value } })
          }
        />
      ))}
      <SelectField
        label={t('programs.reviewStatus')}
        value={program.source.status}
        options={(['draft', 'reviewed_program'] as const).map((value) => ({
          value,
          label: t(`programs.review.${value}`),
        }))}
        onChange={(status) => onChange({ ...program, source: { ...program.source, status } })}
      />
      {PROGRAM_COVERAGE_FIELDS.map((key) => (
        <TextField
          key={key}
          type="date"
          label={t(`programs.coverage.${key}`)}
          value={program.coverage[key]}
          onChange={(event) =>
            onChange({ ...program, coverage: { ...program.coverage, [key]: event.target.value } })
          }
        />
      ))}
      <Button variant="outline" onClick={() => onChange(null)}>
        {t('programs.removeDefinition')}
      </Button>
    </details>
  );
}

export function ProgramCases({
  entry,
  value,
  onChange,
}: {
  entry: DestinationEntry;
  value: ProgramCase[];
  onChange: (value: ProgramCase[]) => void;
}) {
  const { t } = useTranslation('assessments');
  const program = entry.program;
  if (!program) return null;
  const set = (index: number, next: ProgramCase) =>
    onChange(value.map((v, i) => (i === index ? next : v)));
  return (
    <details open className="flex min-w-0 flex-col gap-3">
      <summary className="min-h-11 cursor-pointer py-2">
        {t('programs.referenceTitle', { title: entry.title.fa })}
      </summary>
      <p>{t('independent')}</p>
      {value.map((test, index) => (
        <fieldset key={index} className="border-line m-0 flex min-w-0 flex-col gap-3 border p-3">
          <legend>{t('programs.referenceCase', { index: index + 1 })}</legend>
          {program.bundle.questions.map((question) => {
            const fact = test.answers[question.id];
            return (
              <div key={question.id} className="flex flex-col gap-2">
                <SelectField
                  label={t('programs.referenceAnswer', { question: question.text })}
                  value={fact?.status ?? 'not_supplied'}
                  options={PROGRAM_FACT_STATES.map((value) => ({
                    value,
                    label:
                      value === 'not_supplied'
                        ? t('programs.notSupplied')
                        : t(`calculator.choices.${value}`),
                  }))}
                  onChange={(status) => {
                    const answers = { ...test.answers };
                    if (status === 'not_supplied') {
                      set(index, {
                        ...test,
                        answers: Object.fromEntries(
                          Object.entries(answers).filter(([id]) => id !== question.id),
                        ),
                      });
                      return;
                    } else
                      answers[question.id] = {
                        status,
                        value: status === 'known' ? valueOf(question) : null,
                      };
                    set(index, { ...test, answers });
                  }}
                />
                {fact?.status === 'known' && (
                  <ValueField
                    question={question}
                    value={fact.value ?? ''}
                    onChange={(v) =>
                      set(index, {
                        ...test,
                        answers: { ...test.answers, [question.id]: { ...fact, value: v } },
                      })
                    }
                  />
                )}
              </div>
            );
          })}
          <SelectField
            label={t('programs.expectedConditions')}
            value={test.expected.eligibility_status}
            options={(['met', 'unmet', 'insufficient_information'] as const).map((value) => ({
              value,
              label: t(`programs.conditionsStatus.${value}`),
            }))}
            onChange={(eligibility_status) =>
              set(index, { ...test, expected: { ...test.expected, eligibility_status } })
            }
          />
          <SelectField
            label={t('programs.expectedScoreStatus')}
            value={test.expected.score_status}
            options={(['partial', 'complete_self_reported', 'not_applicable'] as const).map(
              (value) => ({ value, label: t(`programs.scoreStatuses.${value}`) }),
            )}
            onChange={(score_status) =>
              set(index, { ...test, expected: { ...test.expected, score_status } })
            }
          />
          <TextField
            type="number"
            label={t('programs.expectedScore')}
            value={test.expected.score ?? ''}
            onChange={(event) =>
              set(index, {
                ...test,
                expected: {
                  ...test.expected,
                  score: event.target.value === '' ? null : Number(event.target.value),
                },
              })
            }
          />
          <SelectField
            label={t('programs.expectedPass')}
            value={
              test.expected.pass_mark_met === null ? 'unknown' : String(test.expected.pass_mark_met)
            }
            options={[
              { value: 'unknown', label: t('calculator.unknown') },
              { value: 'true', label: t('yes') },
              { value: 'false', label: t('no') },
            ]}
            onChange={(value) =>
              set(index, {
                ...test,
                expected: {
                  ...test.expected,
                  pass_mark_met: value === 'unknown' ? null : value === 'true',
                },
              })
            }
          />
          <Button variant="outline" onClick={() => onChange(value.filter((_, i) => i !== index))}>
            {t('financial.remove')}
          </Button>
        </fieldset>
      ))}
      <Button
        variant="outline"
        disabled={value.length >= 30}
        onClick={() => {
          const expected = blankExpected(
            entry.id,
            Boolean(program.bundle.routes[0]?.scores?.length),
          );
          onChange([
            ...value,
            {
              answers: {},
              expected: {
                eligibility_status: expected.eligibility_status,
                score: expected.score,
                score_status: expected.score_status,
                pass_mark_met: expected.pass_mark_met,
              },
            },
          ]);
        }}
      >
        {t('programs.addReference')}
      </Button>
    </details>
  );
}
