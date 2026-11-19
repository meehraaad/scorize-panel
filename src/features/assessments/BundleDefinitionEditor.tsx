import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { SelectField, TogglePill } from '@/components/ui/Choices';
import { TextField } from '@/components/ui/TextField';
import type { DraftInput } from './api';
import { DefinitionTools } from './DefinitionTools';
import { RuleEditor } from './RuleEditor';
import {
  conditionOf,
  nextId,
  questionReferenced,
  questionUsage,
  removeQuestion,
  removeRoute,
} from './rules';

/** Shared structured authoring for sandbox bundles and country-independent programs. */
export function BundleDefinitionEditor({
  input,
  onChange: update,
  singleRoute = false,
}: {
  input: DraftInput;
  onChange: (next: DraftInput) => void;
  singleRoute?: boolean;
}) {
  const { t } = useTranslation('assessments');
  const setQuestion = (index: number, value: DraftInput['bundle']['questions'][number]) =>
    update({
      ...input,
      scenarios:
        input.bundle.questions[index]?.kind !== value.kind
          ? input.scenarios.map((scenario) => ({
              ...scenario,
              answers: Object.fromEntries(
                Object.entries(scenario.answers).filter(([key]) => key !== value.id),
              ),
            }))
          : input.scenarios,
      bundle: {
        ...input.bundle,
        questions: input.bundle.questions.map((q, i) => (i === index ? value : q)),
      },
    });
  const setRoute = (index: number, value: DraftInput['bundle']['routes'][number]) =>
    update({
      ...input,
      bundle: {
        ...input.bundle,
        routes: input.bundle.routes.map((r, i) => (i === index ? value : r)),
      },
    });
  return (
    <>
      <DefinitionTools
        input={input}
        onChange={update}
        allowRoutes={!singleRoute}
        maxQuestions={singleRoute ? 30 : 100}
      />
      <h2>{t('questions')}</h2>
      {input.bundle.questions.map((q, index) => (
        <details key={q.id} className="rounded-2xl border border-hair p-4">
          <summary className="min-h-11 cursor-pointer">{q.text}</summary>
          <div className="flex flex-col gap-3">
            <p>{t('stableIdentity', { id: q.id })}</p>
            <TextField
              label={t('question')}
              value={q.text}
              onChange={(e) => setQuestion(index, { ...q, text: e.target.value })}
            />
            <TextField
              label={t('questionHelp')}
              value={q.help ?? ''}
              onChange={(e) => setQuestion(index, { ...q, help: e.target.value })}
            />
            <TextField
              label={t('questionEnglish')}
              value={q.translations?.en ?? ''}
              maxLength={512}
              onChange={(e) =>
                setQuestion(index, {
                  ...q,
                  translations: { ...q.translations, en: e.target.value },
                })
              }
            />
            <TextField
              label={t('responseCost')}
              type="number"
              min={1}
              max={100}
              value={q.cost ?? 1}
              onChange={(e) => setQuestion(index, { ...q, cost: Number(e.target.value) })}
            />
            <fieldset
              disabled={questionReferenced(input.bundle, q.id)}
              className="m-0 border-0 p-0"
            >
              <SelectField
                label={t('answerType')}
                value={q.kind}
                options={(['number', 'boolean', 'choice'] as const).map((value) => ({
                  value,
                  label: t(value),
                }))}
                onChange={(kind) => {
                  const next = { ...q, kind };
                  delete next.minimum;
                  delete next.maximum;
                  delete next.choices;
                  if (kind === 'number') {
                    next.minimum = 0;
                    next.maximum = 120;
                  }
                  if (kind === 'choice') next.choices = [t('newChoice')];
                  setQuestion(index, next);
                }}
              />
            </fieldset>
            <p className="text-sm text-text-2">{t('usageHelp')}</p>
            {questionUsage(input.bundle, q.id).map((usage, i) => (
              <p key={i}>
                {usage.route}
                {t('separator')}
                {usage.label}
                {t('separator')}
                {t(usage.reason)}
              </p>
            ))}
            {!questionUsage(input.bundle, q.id).length && <p>{t('unusedQuestion')}</p>}
            {q.kind === 'number' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  type="number"
                  label={t('minimum')}
                  value={q.minimum ?? ''}
                  onChange={(e) => setQuestion(index, { ...q, minimum: Number(e.target.value) })}
                />
                <TextField
                  type="number"
                  label={t('maximum')}
                  value={q.maximum ?? ''}
                  onChange={(e) => setQuestion(index, { ...q, maximum: Number(e.target.value) })}
                />
              </div>
            )}
            {q.choices?.map((choice, i) => (
              <div key={i} className="flex items-end gap-2">
                <TextField
                  label={t('choice')}
                  value={choice}
                  onChange={(e) =>
                    setQuestion(index, {
                      ...q,
                      choices: q.choices?.map((v, n) => (n === i ? e.target.value : v)) ?? [],
                    })
                  }
                />
                <Button
                  variant="outline"
                  disabled={(q.choices?.length ?? 0) <= 1}
                  onClick={() =>
                    setQuestion(index, {
                      ...q,
                      choices: q.choices?.filter((_, n) => n !== i) ?? [],
                    })
                  }
                >
                  {t('removeChoice')}
                </Button>
              </div>
            ))}
            {q.kind === 'choice' && (
              <Button
                variant="outline"
                onClick={() =>
                  setQuestion(index, {
                    ...q,
                    choices: [
                      ...(q.choices ?? []),
                      `${t('newChoice')} ${String((q.choices?.length ?? 0) + 1)}`,
                    ],
                  })
                }
              >
                {t('addChoice')}
              </Button>
            )}
            <TogglePill
              label={t('conditionalQuestion')}
              checked={!!q.show_if}
              onChange={(checked) => {
                const next = { ...q };
                const parent = input.bundle.questions.find((v) => v.id !== q.id);
                if (checked && parent) next.show_if = conditionOf(parent);
                else delete next.show_if;
                setQuestion(index, next);
              }}
            />
            {q.show_if && (
              <RuleEditor
                questions={input.bundle.questions.filter((other) => other.id !== q.id)}
                condition={q.show_if}
                onChange={(show_if) => setQuestion(index, { ...q, show_if })}
              />
            )}
            <Button
              variant="outline"
              disabled={
                input.bundle.questions.length <= 1 || questionReferenced(input.bundle, q.id)
              }
              onClick={() => update(removeQuestion(input, q.id))}
            >
              {t('removeQuestion')}
            </Button>
            {questionReferenced(input.bundle, q.id) && (
              <p className="text-sm text-text-2">{t('removeReferencesFirst')}</p>
            )}
          </div>
        </details>
      ))}
      <h2>{t('routes')}</h2>
      {input.bundle.routes.map((r, index) => (
        <details key={r.id} className="rounded-2xl border border-hair p-4">
          <summary className="min-h-11 cursor-pointer">{r.name}</summary>
          <div className="flex flex-col gap-3">
            <p>{t('stableIdentity', { id: r.id })}</p>
            <TextField
              label={t('name')}
              value={r.name}
              onChange={(e) => setRoute(index, { ...r, name: e.target.value })}
            />
            {r.requirements.map((req, n) => (
              <div key={req.id}>
                <TextField
                  label={t('requirement')}
                  value={req.label}
                  onChange={(e) =>
                    setRoute(index, {
                      ...r,
                      requirements: r.requirements.map((v, i) =>
                        i === n ? { ...v, label: e.target.value } : v,
                      ),
                    })
                  }
                />
                <RuleEditor
                  condition={req.condition}
                  questions={input.bundle.questions}
                  onChange={(condition) =>
                    setRoute(index, {
                      ...r,
                      requirements: r.requirements.map((v, i) =>
                        i === n ? { ...v, condition } : v,
                      ),
                    })
                  }
                />
                <Button
                  variant="outline"
                  disabled={r.requirements.length <= 1}
                  onClick={() =>
                    setRoute(index, {
                      ...r,
                      requirements: r.requirements.filter((_, i) => i !== n),
                    })
                  }
                >
                  {t('removeRequirement')}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const first = input.bundle.questions[0];
                if (first)
                  setRoute(index, {
                    ...r,
                    requirements: [
                      ...r.requirements,
                      {
                        id: nextId('requirement', r.requirements),
                        label: t('newRequirement'),
                        condition: conditionOf(first),
                      },
                    ],
                  });
              }}
            >
              {t('addRequirement')}
            </Button>
            {r.pass_mark !== undefined && (
              <TextField
                type="number"
                label={t('passMark')}
                value={r.pass_mark}
                onChange={(e) => setRoute(index, { ...r, pass_mark: Number(e.target.value) })}
              />
            )}
            {!!r.scores?.length && (
              <TextField
                type="number"
                label={t('totalCap')}
                value={r.score_cap ?? ''}
                onChange={(e) => {
                  const next = { ...r };
                  if (e.target.value === '') delete next.score_cap;
                  else next.score_cap = Number(e.target.value);
                  setRoute(index, next);
                }}
              />
            )}
            {!!r.scores?.length && (
              <TogglePill
                label={t('usePassMark')}
                checked={r.pass_mark !== undefined}
                onChange={(checked) => {
                  const next = { ...r };
                  if (checked) next.pass_mark = 0;
                  else delete next.pass_mark;
                  setRoute(index, next);
                }}
              />
            )}
            {r.scores?.map((criterion, n) => (
              <div key={criterion.id}>
                <TextField
                  type="number"
                  label={t('criterionCap')}
                  value={criterion.cap ?? ''}
                  onChange={(e) =>
                    setRoute(index, {
                      ...r,
                      scores:
                        r.scores?.map((v, i) => {
                          if (i !== n) return v;
                          const next = { ...v };
                          if (e.target.value === '') delete next.cap;
                          else next.cap = Number(e.target.value);
                          return next;
                        }) ?? [],
                    })
                  }
                />
                <TextField
                  label={t('scoreLabel')}
                  value={criterion.label}
                  onChange={(e) =>
                    setRoute(index, {
                      ...r,
                      scores:
                        r.scores?.map((v, i) => (i === n ? { ...v, label: e.target.value } : v)) ??
                        [],
                    })
                  }
                />
                {criterion.bands.map((band, k) => (
                  <div key={band.id}>
                    <TextField
                      type="number"
                      label={t('points')}
                      value={band.points}
                      onChange={(e) =>
                        setRoute(index, {
                          ...r,
                          scores:
                            r.scores?.map((v, i) =>
                              i === n
                                ? {
                                    ...v,
                                    bands: v.bands.map((b, j) =>
                                      j === k ? { ...b, points: Number(e.target.value) } : b,
                                    ),
                                  }
                                : v,
                            ) ?? [],
                        })
                      }
                    />
                    <RuleEditor
                      condition={band.condition}
                      questions={input.bundle.questions}
                      onChange={(condition) =>
                        setRoute(index, {
                          ...r,
                          scores:
                            r.scores?.map((v, i) =>
                              i === n
                                ? {
                                    ...v,
                                    bands: v.bands.map((b, j) =>
                                      j === k ? { ...b, condition } : b,
                                    ),
                                  }
                                : v,
                            ) ?? [],
                        })
                      }
                    />
                    <Button
                      variant="outline"
                      disabled={criterion.bands.length <= 1}
                      onClick={() =>
                        setRoute(index, {
                          ...r,
                          scores:
                            r.scores?.map((v, i) =>
                              i === n ? { ...v, bands: v.bands.filter((_, j) => j !== k) } : v,
                            ) ?? [],
                        })
                      }
                    >
                      {t('removeBand')}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const first = input.bundle.questions[0];
                    if (first)
                      setRoute(index, {
                        ...r,
                        scores:
                          r.scores?.map((v, i) =>
                            i === n
                              ? {
                                  ...v,
                                  bands: [
                                    ...v.bands,
                                    {
                                      id: nextId('band', v.bands),
                                      points: 0,
                                      condition: conditionOf(first),
                                    },
                                  ],
                                }
                              : v,
                          ) ?? [],
                      });
                  }}
                >
                  {t('addBand')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const next = { ...r, scores: r.scores?.filter((_, i) => i !== n) ?? [] };
                    if (!next.scores.length) {
                      delete next.pass_mark;
                      delete next.score_cap;
                    }
                    setRoute(index, next);
                  }}
                >
                  {t('removeScore')}
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                const first = input.bundle.questions[0];
                if (first)
                  setRoute(index, {
                    ...r,
                    scores: [
                      ...(r.scores ?? []),
                      {
                        id: nextId('score', r.scores ?? []),
                        label: t('newScore'),
                        bands: [{ id: 'band-1', points: 0, condition: conditionOf(first) }],
                      },
                    ],
                  });
              }}
            >
              {t('addScore')}
            </Button>
            <Button
              variant="outline"
              disabled={input.bundle.routes.length <= 1}
              onClick={() => update(removeRoute(input, r.id))}
            >
              {t('removeRoute')}
            </Button>
          </div>
        </details>
      ))}
    </>
  );
}
