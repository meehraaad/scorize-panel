import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import type { DraftInput, Question } from './api';
import { blankExpected, conditionOf } from './rules';

/** Stable IDs are chosen at creation. Changes to published definitions require a new version. */
export function DefinitionTools({
  input,
  onChange,
}: {
  input: DraftInput;
  onChange: (next: DraftInput) => void;
}) {
  const { t } = useTranslation('assessments');
  const [kind, setKind] = useState<Question['kind']>('boolean');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState<'question' | 'route'>('question');
  const rows = target === 'question' ? input.bundle.questions : input.bundle.routes;
  const valid =
    /^[a-z][a-z0-9_-]{0,63}$/.test(id) && !rows.some((r) => r.id === id) && name.trim().length > 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hair p-4">
      <h2>{t('definitions')}</h2>
      <SelectField
        label={t('definitionType')}
        value={target}
        onChange={setTarget}
        options={(['question', 'route'] as const).map((value) => ({ value, label: t(value) }))}
      />
      <TextField
        label={t('definitionId')}
        value={id}
        onChange={(e) => setId(e.target.value)}
        hint={t('stableIdHelp')}
      />
      <TextField
        label={t('definitionName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {target === 'question' && (
        <SelectField
          label={t('answerType')}
          value={kind}
          onChange={setKind}
          options={(['boolean', 'number', 'choice'] as const).map((value) => ({
            value,
            label: t(value),
          }))}
        />
      )}
      <Button
        disabled={!valid || rows.length >= (target === 'question' ? 100 : 30)}
        onClick={() => {
          if (target === 'question') {
            const question: Question = {
              id,
              text: name.trim(),
              kind,
              ...(kind === 'number' ? { minimum: 0, maximum: 120 } : {}),
              ...(kind === 'choice' ? { choices: [t('newChoice')] } : {}),
            };
            onChange({
              ...input,
              bundle: { ...input.bundle, questions: [...input.bundle.questions, question] },
            });
          } else {
            const first = input.bundle.questions[0];
            if (!first) return;
            onChange({
              ...input,
              bundle: {
                ...input.bundle,
                routes: [
                  ...input.bundle.routes,
                  {
                    id,
                    name: name.trim(),
                    requirements: [
                      {
                        id: 'requirement-1',
                        label: t('newRequirement'),
                        condition: conditionOf(first),
                      },
                    ],
                  },
                ],
              },
              scenarios: input.scenarios.map((s) => ({
                ...s,
                expected: [...s.expected, blankExpected(id)],
              })),
            });
          }
          setId('');
          setName('');
        }}
      >
        {t(target === 'question' ? 'addQuestion' : 'addRoute')}
      </Button>
    </div>
  );
}
