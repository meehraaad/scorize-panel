import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import type { Condition, Question, Value } from './api';

import { conditionOf, valueOf } from './rules';

export function ValueField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: Value;
  onChange: (value: Value) => void;
}) {
  const { t } = useTranslation('assessments');
  return question.kind === 'number' ? (
    <TextField
      label={question.text}
      type="number"
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ) : (
    <SelectField
      label={question.text}
      value={String(value)}
      onChange={(v) => onChange(question.kind === 'boolean' ? v === 'true' : v)}
      options={
        question.kind === 'boolean'
          ? [
              { value: 'true', label: t('yes') },
              { value: 'false', label: t('no') },
            ]
          : (question.choices ?? []).map((v) => ({ value: v, label: v }))
      }
    />
  );
}

/** All/any groups, typed comparisons and membership; no JSON or executable code. */
export function RuleEditor({
  condition,
  questions,
  onChange,
  depth = 0,
}: {
  condition: Condition;
  questions: Question[];
  onChange: (condition: Condition) => void;
  depth?: number;
}) {
  const { t } = useTranslation('assessments');
  const first = questions[0];
  if (!first) return null;
  const mode = 'all' in condition ? 'all' : 'any' in condition ? 'any' : 'fact';
  const children = 'all' in condition ? condition.all : 'any' in condition ? condition.any : null;
  const setChildren = (items: Condition[]) =>
    onChange(mode === 'all' ? { all: items } : { any: items });
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hair p-3">
      <SelectField
        label={t('rule')}
        value={mode}
        onChange={(v) =>
          onChange(
            v === 'fact'
              ? conditionOf(first)
              : v === 'all'
                ? { all: [conditionOf(first)] }
                : { any: [conditionOf(first)] },
          )
        }
        options={(['fact', 'all', 'any'] as const)
          .filter((v) => depth < 10 || v === 'fact')
          .map((v) => ({ value: v, label: t(v) }))}
      />
      {children ? (
        <>
          {children.map((child, index) => (
            <div key={index} className="flex flex-col gap-2 ps-3">
              <RuleEditor
                condition={child}
                questions={questions}
                depth={depth + 1}
                onChange={(next) =>
                  setChildren(children.map((item, i) => (i === index ? next : item)))
                }
              />
              {children.length > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setChildren(children.filter((_, i) => i !== index))}
                >
                  {t('remove')}
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            disabled={children.length >= 30}
            onClick={() => setChildren([...children, conditionOf(first)])}
          >
            {t('addCondition')}
          </Button>
        </>
      ) : (
        'fact' in condition && (
          <>
            <SelectField
              label={t('question')}
              value={condition.fact}
              onChange={(id) => {
                const q = questions.find((item) => item.id === id);
                if (q) onChange(conditionOf(q));
              }}
              options={questions.map((q) => ({ value: q.id, label: q.text }))}
            />
            <SelectField
              label={t('operator')}
              value={condition.op}
              onChange={(op) =>
                onChange({
                  ...condition,
                  op,
                  value:
                    op === 'in'
                      ? [
                          Array.isArray(condition.value)
                            ? (condition.value[0] ?? '')
                            : condition.value,
                        ]
                      : Array.isArray(condition.value)
                        ? (condition.value[0] ?? '')
                        : condition.value,
                })
              }
              options={(
                [
                  'eq',
                  'in',
                  ...(questions.find((q) => q.id === condition.fact)?.kind === 'number'
                    ? (['gte', 'gt', 'lte', 'lt'] as const)
                    : []),
                ] as const
              ).map((value) => ({ value, label: t(value) }))}
            />
            {(() => {
              const q = questions.find((item) => item.id === condition.fact);
              if (!q) return null;
              const values = Array.isArray(condition.value) ? condition.value : [condition.value];
              return condition.op === 'in' ? (
                <>
                  {values.map((v, index) => (
                    <div key={index}>
                      <ValueField
                        question={q}
                        value={v}
                        onChange={(value) =>
                          onChange({
                            ...condition,
                            value: values.map((item, i) => (i === index ? value : item)),
                          })
                        }
                      />
                      {values.length > 1 && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            onChange({ ...condition, value: values.filter((_, i) => i !== index) })
                          }
                        >
                          {t('remove')}
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => onChange({ ...condition, value: [...values, valueOf(q)] })}
                  >
                    {t('addValue')}
                  </Button>
                </>
              ) : (
                <ValueField
                  question={q}
                  value={values[0] ?? valueOf(q)}
                  onChange={(value) => onChange({ ...condition, value })}
                />
              );
            })()}
          </>
        )
      )}
    </div>
  );
}
